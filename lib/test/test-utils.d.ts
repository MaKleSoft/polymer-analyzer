import { SourceRange, Warning } from '../model/model';
import { UrlLoader } from '../url-loader/url-loader';
import { WarningPrinter } from '../warning/warning-printer';
export declare class UnexpectedResolutionError extends Error {
    resolvedValue: any;
    constructor(message: string, resolvedValue: any);
}
export declare function invertPromise(promise: Promise<any>): Promise<any>;
export declare class TestUrlLoader implements UrlLoader {
    files: {
        [path: string]: string;
    };
    constructor(files: {
        [path: string]: string;
    });
    canLoad(url: string): boolean;
    load(url: string): Promise<string>;
}
export declare type Reference = Warning | SourceRange | undefined;
/**
 * Used for asserting that warnings or source ranges correspond to the right
 * parts of the source code.
 *
 * Non-test code probably wants WarningPrinter instead.
 */
export declare class CodeUnderliner {
    warningPrinter: WarningPrinter;
    constructor(urlLoader: UrlLoader);
    static withMapping(url: string, contents: string): CodeUnderliner;
    /**
     * Converts one or more warnings/source ranges into underlined text.
     *                                                  ~~~~~~~~~~ ~~~~
     *
     * This has a loose set of types that it will accept in order to make
     * writing tests simple and legible.
     */
    underline(reference: Reference): Promise<string>;
    underline(references: Reference[]): Promise<string[]>;
}
