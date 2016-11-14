/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

/// <reference path="../custom_typings/main.d.ts" />

import * as path from 'path';

import {AnalysisCache, getImportersOf} from './analysis-cache';
import {CssParser} from './css/css-parser';
import {HtmlCustomElementReferenceScanner} from './html/html-element-reference-scanner';
import {HtmlImportScanner} from './html/html-import-scanner';
import {HtmlParser} from './html/html-parser';
import {HtmlScriptScanner} from './html/html-script-scanner';
import {HtmlStyleScanner} from './html/html-style-scanner';
import {JavaScriptParser} from './javascript/javascript-parser';
import {JsonParser} from './json/json-parser';
import {Document, InlineDocInfo, LocationOffset, ScannedDocument, ScannedElement, ScannedFeature, ScannedImport, ScannedInlineDocument} from './model/model';
import {ParsedDocument} from './parser/document';
import {Parser} from './parser/parser';
import {Measurement, TelemetryTracker} from './perf/telemetry';
import {BehaviorScanner} from './polymer/behavior-scanner';
import {CssImportScanner} from './polymer/css-import-scanner';
import {DomModuleScanner} from './polymer/dom-module-scanner';
import {PolymerElementScanner} from './polymer/polymer-element-scanner';
import {scan} from './scanning/scan';
import {Scanner} from './scanning/scanner';
import {UrlLoader} from './url-loader/url-loader';
import {UrlResolver} from './url-loader/url-resolver';
import {ElementScanner as VanillaElementScanner} from './vanilla-custom-elements/element-scanner';
import {Severity, Warning, WarningCarryingException} from './warning/warning';

export interface Options {
  urlLoader: UrlLoader;
  urlResolver?: UrlResolver;
  parsers?: Map<string, Parser<any>>;
  scanners?: ScannerTable;
  /*
   * Map from url of an HTML Document to another HTML document it lazily depends
   * on.
   */
  lazyEdges?: LazyEdgeMap;
}

export class NoKnownParserError extends Error {};

export type ScannerTable = Map<string, Scanner<any, any, any>[]>;
export type LazyEdgeMap = Map<string, string[]>;

/**
 * A static analyzer for web projects.
 *
 * An Analyzer can load and parse documents of various types, and extract
 * arbitratrary information from the documents, and transitively load
 * dependencies. An Analyzer instance is configured with parsers, and scanners
 * which do the actual work of understanding different file types.
 */
export class Analyzer {
  private _cacheContext: AnalyzerCacheContext;
  constructor(options: Options) {
    this._cacheContext = new AnalyzerCacheContext(options);
  }

  /**
   * Loads, parses and analyzes the root document of a dependency graph and its
   * transitive dependencies.
   *
   * Note: The analyzer only supports analyzing a single root for now. This
   * is because each analyzed document in the dependency graph has a single
   * root. This mean that we can't properly analyze app-shell-style, lazy
   * loading apps.
   *
   * @param contents Optional contents of the file when it is known without
   * reading it from disk. Clears the caches so that the news contents is used
   * and reanalyzed. Useful for editors that want to re-analyze changed files.
   */
  async analyze(url: string, contents?: string): Promise<Document> {
    if (contents != null) {
      this._cacheContext = this._cacheContext.fileChanged(url);
    }
    return this._cacheContext.analyze(url, contents);
  }

  async getTelemetryMeasurements(): Promise<Measurement[]> {
    return this._cacheContext.getTelemetryMeasurements();
  }

  /**
   * Clear all cached information from this analyzer instance.
   *
   * Note: if at all possible, instead tell the analyzer about the specific
   * files that changed rather than clearing caches like this. Caching provides
   * large performance gains.
   */
  clearCaches(): void {
    this._cacheContext = this._cacheContext.clearCaches();
  }

  /**
   * Loads the content at the provided resolved URL.
   *
   * Currently does no caching. If the provided contents are given then they
   * are used instead of hitting the UrlLoader (e.g. when you have in-memory
   * contents that should override disk).
   */
  async load(resolvedUrl: string, providedContents?: string) {
    return this._cacheContext.load(resolvedUrl, providedContents);
  }
}

/**
 * Represents an Analyzer with a given AnalysisCache instance.
 *
 * Used to provide a consistent cache in the face of updates happening in
 * parallel with analysis work. A given AnalyzerCacheContext is forked via
 * either the fileChanged or clearCaches methods.
 *
 * For almost all purposes this is an entirely internal implementation detail.
 */
export class AnalyzerCacheContext {
  private _parsers = new Map<string, Parser<ParsedDocument<any, any>>>([
    ['html', new HtmlParser()],
    ['js', new JavaScriptParser({sourceType: 'script'})],
    ['css', new CssParser()],
    ['json', new JsonParser()],
  ]);

  /** A map from import url to urls that document lazily depends on. */
  private _lazyEdges: LazyEdgeMap|undefined;

  private _scanners: ScannerTable;

  private _loader: UrlLoader;
  private _resolver: UrlResolver|undefined;

  private _cache = new AnalysisCache();

  private _telemetryTracker = new TelemetryTracker();
  private _generation = 0;

  private static _getDefaultScanners(lazyEdges: LazyEdgeMap|undefined) {
    return new Map<string, Scanner<any, any, any>[]>([
      [
        'html',
        [
          new HtmlImportScanner(lazyEdges),
          new HtmlScriptScanner(),
          new HtmlStyleScanner(),
          new DomModuleScanner(),
          new CssImportScanner(),
          new HtmlCustomElementReferenceScanner()
        ]
      ],
      [
        'js',
        [
          new PolymerElementScanner(),
          new BehaviorScanner(),
          new VanillaElementScanner()
        ]
      ],
    ]);
  }

  constructor(options: Options) {
    this._loader = options.urlLoader;
    this._resolver = options.urlResolver;
    this._parsers = options.parsers || this._parsers;
    this._lazyEdges = options.lazyEdges;
    this._scanners = options.scanners ||
        AnalyzerCacheContext._getDefaultScanners(this._lazyEdges);
  }

  /**
   * Returns a copy of this cache context with proper cache invalidation.
   */
  fileChanged(url: string) {
    const resolvedUrl = this._resolveUrl(url);
    const dependants = getImportersOf(
        resolvedUrl,
        this._cache.analyzedDocuments.values(),
        this._cache.scannedDocuments.values(),
        (url) => this._resolveUrl(url));
    console.log(`Analyzed documents: ${JSON.stringify(
        Array.from(this._cache.analyzedDocuments.values()).map(d => d.url))}`);
    console.log(
        `Dependants of ${url}: ${JSON.stringify(Array.from(dependants))}`);
    const newCache = this._cache.onPathChanged(resolvedUrl, dependants);
    return this._fork(newCache);
  }

  /**
   * Loads, parses and analyzes the root document of a dependency graph and its
   * transitive dependencies.
   *
   * Note: The analyzer only supports analyzing a single root for now. This
   * is because each analyzed document in the dependency graph has a single
   * root. This mean that we can't properly analyze app-shell-style, lazy
   * loading apps.
   *
   * @param contents Optional contents of the file when it is known without
   * reading it from disk. You should call fileChanged first before passing in
   * contents, or you may get a cached result.
   */
  async analyze(url: string, contents?: string): Promise<Document> {
    const resolvedUrl = this._resolveUrl(url);

    const cachedResult = this._cache.analyzedDocumentPromises.get(resolvedUrl);
    if (cachedResult) {
      return cachedResult;
    }

    const promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise is cached before anything else happens.
      await Promise.resolve();
      const doneTiming =
          this._telemetryTracker.start('analyze: make document', url);
      const scannedDocument = await this._scan(resolvedUrl, contents);
      if (scannedDocument === 'visited') {
        throw new Error(
            `This should not happen. Got a cycle of length zero(!) scanning ${url
            }`);
      }
      console.log(`got scanned document for ${resolvedUrl}`);
      // Need to be sure that ScannedImport#scannedDocument has been set.
      // Yes this is totally a hack.
      await Promise.resolve();
      const document = this._makeDocument(scannedDocument);
      doneTiming();
      return document;
    })();
    this._cache.analyzedDocumentPromises.set(resolvedUrl, promise);
    return promise;
  }

  /**
   * Constructs a new analyzed Document and adds it to the analyzed Document
   * cache.
   */
  private _makeDocument(scannedDocument: ScannedDocument): Document {
    const resolvedUrl = scannedDocument.url;

    if (this._cache.analyzedDocuments.has(resolvedUrl)) {
      throw new Error(`Internal error: document ${resolvedUrl} already exists`);
    }

    const document = new Document(scannedDocument, this);
    if (!this._cache.analyzedDocumentPromises.has(resolvedUrl)) {
      this._cache.analyzedDocumentPromises.set(
          resolvedUrl, Promise.resolve(document));
    }
    this._cache.analyzedDocuments.set(resolvedUrl, document);
    document.resolve();
    return document;
  }

  /**
   * Gets an analyzed Document from the document cache. This is only useful for
   * Analyzer plugins. You almost certainly want to use `analyze()` instead.
   *
   * If a document has been analyzed, it returns the analyzed Document. If not
   * the scanned document cache is used and a new analyzed Document is returned.
   * If a file is in neither cache, it returns `undefined`.
   */
  _getDocument(url: string): Document|undefined {
    const resolvedUrl = this._resolveUrl(url);
    let document = this._cache.analyzedDocuments.get(resolvedUrl);
    if (document) {
      return document;
    }
    const scannedDocument = this._cache.scannedDocuments.get(resolvedUrl);
    if (!scannedDocument) {
      console.log(`unable to find scanned or analyzed document ${resolvedUrl
        } in the generation ${this._generation} cache`);
        // throw new Error(`unable to find scanned or analyzed document
        // ${resolvedUrl
        //                 } in the generation ${this._generation} cache`);
    }
    return scannedDocument && this._makeDocument(scannedDocument);
  }

  async getTelemetryMeasurements(): Promise<Measurement[]> {
    return this._telemetryTracker.getMeasurements();
  }

  /**
   * Clear all cached information from this analyzer instance.
   *
   * Note: if at all possible, instead tell the analyzer about the specific
   * files that changed rather than clearing caches like this. Caching provides
   * large performance gains.
   */
  clearCaches(): AnalyzerCacheContext {
    return this._fork(new AnalysisCache());
  }

  /**
   * Return a copy, but with the given cache.
   */
  private _fork(cache: AnalysisCache): AnalyzerCacheContext {
    const copy = new AnalyzerCacheContext({
      lazyEdges: this._lazyEdges,
      parsers: this._parsers,
      scanners: this._scanners,
      urlLoader: this._loader,
      urlResolver: this._resolver
    });
    copy._telemetryTracker = this._telemetryTracker;
    copy._cache = cache;
    copy._generation = this._generation + 1;
    return copy;
  }

  /**
   * Scan a toplevel document given its url and optionally its contents.
   */
  private async _scan(
      resolvedUrl: string, contents?: string,
      visited?: Set<string>): Promise<ScannedDocument|'visited'> {
    if (visited && visited.has(resolvedUrl)) {
      return 'visited';
    }
    const actualVisited = visited || new Set();
    actualVisited.add(resolvedUrl);
    const cachedResult = this._cache.scannedDocumentPromises.get(resolvedUrl);
    if (cachedResult) {
      console.log(
          `found scanned doc for ${resolvedUrl}` +
          ` in the gen ${this._generation} cache`);
      await this._scanDependenciesOfToplevelDoc(
          await cachedResult, actualVisited);
      return cachedResult;
    } else {
      console.log(`did not find scanned doc for ${resolvedUrl
                  } in the gen ${this._generation} cache, scanning`);
    }
    const promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise is cached before anything else happens.
      await Promise.resolve();
      const document = await this._parse(resolvedUrl, contents);
      return this._scanDocument(document);
    })();
    this._cache.scannedDocumentPromises.set(resolvedUrl, promise);
    const scannedDocument = await promise;
    await this._scanDependenciesOfToplevelDoc(scannedDocument, actualVisited);
    console.log(
        `finished scanning dependencies of toplevel doc ${resolvedUrl}`);
    return scannedDocument;
  }

  /**
   * Parses and scans a document from source.
   */
  private async _scanInlineSource(
      type: string, contents: string, url: string, visited: Set<string>,
      inlineInfo?: InlineDocInfo<any>,
      attachedComment?: string): Promise<ScannedDocument> {
    const resolvedUrl = this._resolveUrl(url);
    const parsedDoc =
        this._parseContents(type, contents, resolvedUrl, inlineInfo);
    const scannedDoc = await this._scanDocument(parsedDoc, attachedComment);
    await this._scanDependencies(scannedDoc, visited);
    return scannedDoc;
  }

  /**
   * Scans a ParsedDocument.
   */
  private async _scanDocument(
      document: ParsedDocument<any, any>,
      maybeAttachedComment?: string): Promise<ScannedDocument> {
    const warnings: Warning[] = [];
    const scannedFeatures = await this._getScannedFeatures(document);
    // If there's an HTML comment that applies to this document then we assume
    // that it applies to the first feature.
    const firstScannedFeature = scannedFeatures[0];
    if (firstScannedFeature && firstScannedFeature instanceof ScannedElement) {
      firstScannedFeature.applyHtmlComment(maybeAttachedComment);
    }

    const scannedDocument =
        new ScannedDocument(document, scannedFeatures, warnings);

    if (!scannedDocument.isInline) {
      if (this._cache.scannedDocuments.has(scannedDocument.url)) {
        throw new Error(
            'Scanned document already in cache. This should never happen.');
      }
      this._cache.scannedDocuments.set(scannedDocument.url, scannedDocument);
    }

    return scannedDocument;
  }

  private async _scanDependenciesOfToplevelDoc(
      scannedDocument: ScannedDocument, visited: Set<string>) {
    const wasCached = this._cache.dependenciesScanned.has(scannedDocument.url);
    if (wasCached) {
      console.log(
          `found that ${scannedDocument
              .url} has already scanned its dependencies in the gen ${this
              ._generation} cache`);
    } else {
      console.log(
          `found that ${scannedDocument
              .url} has not yet had its dependencies scanned in the gen ${this
              ._generation} cache`);
    }
    const scanDepPromise =
        this._cache.dependenciesScanned.get(scannedDocument.url) ||
        this._scanDependencies(scannedDocument, visited);
    this._cache.dependenciesScanned.set(scannedDocument.url, scanDepPromise);
    console.log(
        `Gonna await on scanDepPromise in _scanDependenciesOfToplevelDoc`);
    await scanDepPromise;
    console.log(
        `await finished on scanDepPromise in _scanDependenciesOfToplevelDoc`);
    if (!wasCached) {
      console.log(`scanned dependencies of ${scannedDocument.url
                  } for gen ${this._generation} cache`);
    }
    return scanDepPromise;
  }

  /**
   * Scan all the dependencies of the given scanned document.
   *
   * This must be called exactly once per scanned document, as we mutate
   * the given scannedDocument by adding warnings.
   */
  private async _scanDependencies(
      scannedDocument: ScannedDocument, visited: Set<string>): Promise<void> {
    const scannedDependencies: ScannedFeature[] =
        scannedDocument.features.filter(
            (e) => e instanceof ScannedInlineDocument ||
                e instanceof ScannedImport);
    const scannedSubDocuments =
        scannedDependencies.map(async(scannedDependency) => {
          if (scannedDependency instanceof ScannedInlineDocument) {
            return this._scanInlineDocument(
                scannedDependency,
                scannedDocument.document,
                scannedDocument.warnings,
                visited);
          } else if (scannedDependency instanceof ScannedImport) {
            // TODO(garlicnation): Move this logic into model/document. During
            // the recursive feature walk, features from lazy imports
            // should be marked.
            if (scannedDependency.type !== 'lazy-html-import') {
              return this._scanImport(
                  scannedDependency, scannedDocument.warnings, visited);
            }
            return null;
          } else {
            throw new Error(`Unexpected dependency type: ${scannedDependency}`);
          }
        });
    await Promise.all(scannedSubDocuments);
  }

  /**
   * Scan an inline document found within a containing parsed doc.
   */
  private async _scanInlineDocument(
      inlineDoc: ScannedInlineDocument,
      containingDocument: ParsedDocument<any, any>, warnings: Warning[],
      visited: Set<string>): Promise<ScannedDocument|null> {
    const locationOffset: LocationOffset = {
      line: inlineDoc.locationOffset.line,
      col: inlineDoc.locationOffset.col,
      filename: containingDocument.url
    };
    const inlineInfo = {locationOffset, astNode: inlineDoc.astNode};
    try {
      const scannedDocument = await this._scanInlineSource(
          inlineDoc.type,
          inlineDoc.contents,
          containingDocument.url,
          visited,
          inlineInfo,
          inlineDoc.attachedComment);
      inlineDoc.scannedDocument = scannedDocument;
      return scannedDocument;
    } catch (err) {
      if (err instanceof WarningCarryingException) {
        warnings.push(err.warning);
        return null;
      }
      throw err;
    }
  }

  private async _scanImport(
      scannedImport: ScannedImport, warnings: Warning[],
      visited: Set<string>): Promise<null> {
    const url = this._resolveUrl(scannedImport.url);
    try {
      await this._scan(url, undefined, visited);
    } catch (error) {
      if (error instanceof NoKnownParserError) {
        // We probably don't want to fail when importing something
        // that we don't know about here.
        return null;
      }
      error = error || '';
      warnings.push({
        code: 'could-not-load',
        message: `Unable to load import: ${error.message || error}`,
        sourceRange:
            (scannedImport.urlSourceRange || scannedImport.sourceRange)!,
        severity: Severity.ERROR
      });
      return null;
    }
    this._cache.scannedDocumentPromises.get(url)!.then((scannedDocument) => {
      scannedImport.scannedDocument = scannedDocument;
    });
    return null;
  }

  /**
   * Loads the content at the provided resolved URL.
   *
   * Currently does no caching. If the provided contents are given then they
   * are used instead of hitting the UrlLoader (e.g. when you have in-memory
   * contents that should override disk).
   */
  async load(resolvedUrl: string, providedContents?: string) {
    if (!this._loader.canLoad(resolvedUrl)) {
      throw new Error(`Can't load URL: ${resolvedUrl}`);
    }
    return providedContents == null ? await this._loader.load(resolvedUrl) :
                                      providedContents;
  }

  private async _parse(resolvedUrl: string, providedContents?: string):
      Promise<ParsedDocument<any, any>> {
    const cachedResult = this._cache.parsedDocumentPromises.get(resolvedUrl);
    if (cachedResult) {
      return cachedResult;
    }

    // Use an immediately executed async function to create the final Promise
    // synchronously so we can store it in this._documents before any other
    // async operations to avoid any race conditions.
    const promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise can be cached.
      await Promise.resolve();

      const content = await this.load(resolvedUrl, providedContents);
      const extension = path.extname(resolvedUrl).substring(1);

      const doneTiming = this._telemetryTracker.start('parse', 'resolvedUrl');
      const parsedDoc = this._parseContents(extension, content, resolvedUrl);
      doneTiming();
      return parsedDoc;
    })();
    this._cache.parsedDocumentPromises.set(resolvedUrl, promise);
    return promise;
  }

  private _parseContents(
      type: string, contents: string, url: string,
      inlineInfo?: InlineDocInfo<any>): ParsedDocument<any, any> {
    const parser = this._parsers.get(type);
    if (parser == null) {
      throw new NoKnownParserError(`No parser for for file type ${type}`);
    }
    try {
      return parser.parse(contents, url, inlineInfo);
    } catch (error) {
      if (error instanceof WarningCarryingException) {
        throw error;
      }
      throw new Error(`Error parsing ${url}:\n ${error.stack}`);
    }
  }

  private async _getScannedFeatures(document: ParsedDocument<any, any>):
      Promise<ScannedFeature[]> {
    const scanners = this._scanners.get(document.type);
    if (scanners) {
      return scan(document, scanners);
    }
    return [];
  }

  /**
   * Resolves a URL with this Analyzer's `UrlResolver` if it has one, otherwise
   * returns the given URL.
   */
  private _resolveUrl(url: string): string {
    return this._resolver && this._resolver.canResolve(url) ?
        this._resolver.resolve(url) :
        url;
  }
}
