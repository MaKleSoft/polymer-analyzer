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

import * as ts from 'typescript';
import {Node} from 'typescript';

import {SourceRange} from '../model/model';
import {Options, ParsedDocument, StringifyOptions} from '../parser/document';

import {Visitor} from './typescript-visitor';

export {Node, Program} from 'typescript';
export {Options} from '../parser/document';
export {Visitor} from './typescript-visitor';

export class ParsedTypeScriptDocument extends ParsedDocument<Node, Visitor> {
  type = 'typescript';

  constructor(from: Options<Node>) {
    // This constructor is neccessary because the default constructor that
    // TypeScript generates uses spread syntax which in unsupported by node 4.
    super(from);
  }

  visit(visitors: Visitor[]) {
    const sourceFile = this.ast;
    for (const visitor of visitors) {
      ts.forEachChild(sourceFile, (node) => visitor.visitNode(node));
    }
  }

  forEachNode(_callback: (node: Node) => void) {
    // TODO(justinfagnani): implement
    throw new Error('unsupported');
  }

  protected _sourceRangeForNode(_node: Node): SourceRange|undefined {
    // TODO(justinfagnani): implement
    throw new Error('unsupported');
  }

  stringify(_options: StringifyOptions): string {
    // TODO(justinfagnani): implement
    throw new Error('unsupported');
  }
}
