import * as estree from 'estree';
import { InlineDocInfo, LocationOffset, Warning } from '../model/model';
import { Parser } from '../parser/parser';
import { JavaScriptDocument } from './javascript-document';
export declare const baseParseOptions: {
    ecmaVersion: number;
    attachComment: boolean;
    comment: boolean;
    loc: boolean;
};
export declare class JavaScriptParser implements Parser<JavaScriptDocument> {
    parse(contents: string, url: string, inlineInfo?: InlineDocInfo<any>): JavaScriptDocument;
}
export declare type ParseResult = {
    type: 'success';
    sourceType: 'script' | 'module';
    program: estree.Program;
} | {
    type: 'failure';
    warning: Warning;
};
/**
 * Parse the given contents and return either an AST or a parse error as a
 * Warning.
 *
 * It needs the filename and the location offset to produce correct warnings.
 */
export declare function parseJs(contents: string, file: string, locationOffset?: LocationOffset, warningCode?: string): ParseResult;
