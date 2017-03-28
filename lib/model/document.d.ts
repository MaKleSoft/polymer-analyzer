/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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
import * as dom5 from 'dom5';
import { AnalysisContext } from '../core/analysis-context';
import { Function } from '../javascript/function';
import { Namespace } from '../javascript/namespace';
import { ParsedDocument } from '../parser/document';
import { Behavior } from '../polymer/behavior';
import { DomModule } from '../polymer/dom-module-scanner';
import { PolymerElement } from '../polymer/polymer-element';
import { PolymerElementMixin } from '../polymer/polymer-element-mixin';
import { Element } from './element';
import { ElementMixin } from './element-mixin';
import { ElementReference } from './element-reference';
import { Feature, ScannedFeature } from './feature';
import { Import } from './import';
import { BaseQueryOptions, Queryable } from './queryable';
import { SourceRange } from './source-range';
import { Warning } from './warning';
/**
 * The metadata for all features and elements defined in one document
 */
export declare class ScannedDocument {
    document: ParsedDocument<any, any>;
    features: ScannedFeature[];
    warnings: Warning[];
    isInline: boolean;
    readonly sourceRange: SourceRange;
    readonly astNode: any;
    constructor(document: ParsedDocument<any, any>, features: ScannedFeature[], warnings?: Warning[]);
    readonly url: string;
    /**
     * Gets all features in this scanned document and all inline documents it
     * contains.
     */
    getNestedFeatures(): ScannedFeature[];
    private _getNestedFeatures(features);
}
export interface FeatureKinds {
    'document': Document;
    'element': Element;
    'element-mixin': ElementMixin;
    'polymer-element': PolymerElement;
    'polymer-element-mixin': PolymerElementMixin;
    'behavior': Behavior;
    'namespace': Namespace;
    'function': Function;
    'dom-module': DomModule;
    'element-reference': ElementReference;
    'import': Import;
    'html-document': Document;
    'js-document': Document;
    'json-document': Document;
    'css-document': Document;
    'html-import': Import;
    'html-script': Import;
    'html-style': Import;
    'js-import': Import;
    'css-import': Import;
}
export interface QueryOptionsInterface extends BaseQueryOptions {
    /**
     * If true, the query will return results from the document and its
     * dependencies. Otherwise it will only include results from the document.
     */
    imported?: boolean;
    lazyImports?: boolean;
}
export declare type QueryOptions = object & QueryOptionsInterface;
export declare class Document implements Feature, Queryable {
    kinds: Set<string>;
    identifiers: Set<string>;
    analyzer: AnalysisContext;
    warnings: Warning[];
    languageAnalysis?: any;
    private _localFeatures;
    private _scannedDocument;
    /**
     * To handle recursive dependency graphs we must track whether we've started
     * resolving this Document so that we can reliably early exit even if one
     * of our dependencies tries to resolve this document.
     */
    private _begunResolving;
    /**
     * True after this document and all of its children are finished resolving.
     */
    private _doneResolving;
    constructor(base: ScannedDocument, analyzer: AnalysisContext, languageAnalysis?: any);
    readonly url: string;
    readonly isInline: boolean;
    readonly sourceRange: SourceRange | undefined;
    readonly astNode: dom5.Node | undefined;
    readonly parsedDocument: ParsedDocument<any, any>;
    readonly resolved: boolean;
    readonly type: string;
    /**
     * Resolves all features of this document, so that they have references to all
     * their dependencies.
     *
     * This method can only be called once
     */
    resolve(): void;
    /**
     * Adds and indexes a feature to this documentled before resolve().
     */
    _addFeature(feature: Feature): void;
    getByKind<K extends keyof FeatureKinds>(kind: K, options?: QueryOptions): Set<FeatureKinds[K]>;
    getByKind(kind: string, options?: QueryOptions): Set<Feature>;
    getById<K extends keyof FeatureKinds>(kind: K, identifier: string, options?: QueryOptions): Set<FeatureKinds[K]>;
    getById(kind: string, identifier: string, options?: QueryOptions): Set<Feature>;
    getOnlyAtId<K extends keyof FeatureKinds>(kind: K, identifier: string, options?: QueryOptions): FeatureKinds[K] | undefined;
    getOnlyAtId(kind: string, identifier: string, options?: QueryOptions): Feature | undefined;
    getFeatures(options?: QueryOptions): Set<Feature>;
    private _getByKind(kind, options);
    private _getFeatures(result, visited, options);
    private _filterOutExternal(features);
    /**
     * Get warnings for the document and all matched features.
     */
    getWarnings(options?: QueryOptions): Warning[];
    toString(): string;
    private _toString(documentsWalked);
    stringify(): string;
    private _featuresByKind;
    private _featuresByKindAndId;
    private _initIndexes();
    private _indexFeature(feature);
    private _buildIndexes();
}
