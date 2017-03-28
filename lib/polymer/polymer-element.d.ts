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
import * as dom5 from 'dom5';
import * as estree from 'estree';
import { Annotation as JsDocAnnotation } from '../javascript/jsdoc';
import { Document, Element, ElementBase, LiteralValue, Method, Privacy, Property, ScannedAttribute, ScannedElement, ScannedElementBase, ScannedEvent, ScannedMethod, ScannedProperty, SourceRange, Warning } from '../model/model';
import { ScannedReference } from '../model/reference';
import { Behavior, ScannedBehaviorAssignment } from './behavior';
import { JavascriptDatabindingExpression } from './expression-scanner';
export interface BasePolymerProperty {
    published?: boolean;
    notify?: boolean;
    observer?: string;
    observerNode?: estree.Expression | estree.Pattern;
    observerExpression?: JavascriptDatabindingExpression;
    reflectToAttribute?: boolean;
    computedExpression?: JavascriptDatabindingExpression;
    /**
     * True if the property is part of Polymer's element configuration syntax.
     *
     * e.g. 'properties', 'is', 'extends', etc
     */
    isConfiguration?: boolean;
}
export interface ScannedPolymerProperty extends ScannedProperty, BasePolymerProperty {
}
export interface PolymerProperty extends Property, BasePolymerProperty {
}
export declare class LocalId {
    name: string;
    range: SourceRange;
    constructor(name: string, range: SourceRange);
}
export interface Observer {
    javascriptNode: estree.Expression | estree.SpreadElement;
    expression: LiteralValue;
    parsedExpression: JavascriptDatabindingExpression | undefined;
}
export interface Options {
    tagName?: string;
    className?: string;
    superClass?: ScannedReference;
    mixins?: ScannedReference[];
    extends?: string;
    jsdoc?: JsDocAnnotation;
    description?: string;
    properties?: ScannedProperty[];
    methods?: ScannedMethod[];
    attributes?: ScannedAttribute[];
    observers?: Observer[];
    listeners?: {
        event: string;
        handler: string;
    }[];
    behaviors?: ScannedBehaviorAssignment[];
    demos?: {
        desc: string;
        path: string;
    }[];
    events?: ScannedEvent[];
    abstract?: boolean;
    privacy: Privacy;
    astNode: any;
    sourceRange: SourceRange | undefined;
}
export interface ScannedPolymerExtension extends ScannedElementBase {
    properties: ScannedPolymerProperty[];
    methods: ScannedMethod[];
    observers: Observer[];
    listeners: {
        event: string;
        handler: string;
    }[];
    behaviorAssignments: ScannedBehaviorAssignment[];
    domModule?: dom5.Node;
    scriptElement?: dom5.Node;
    pseudo: boolean;
    abstract?: boolean;
    addProperty(prop: ScannedPolymerProperty): void;
}
export declare function addProperty(target: ScannedPolymerExtension, prop: ScannedPolymerProperty): void;
export declare function addMethod(target: ScannedPolymerExtension, method: ScannedMethod): void;
/**
 * The metadata for a single polymer element
 */
export declare class ScannedPolymerElement extends ScannedElement implements ScannedPolymerExtension {
    properties: ScannedPolymerProperty[];
    methods: ScannedMethod[];
    observers: Observer[];
    listeners: {
        event: string;
        handler: string;
    }[];
    behaviorAssignments: ScannedBehaviorAssignment[];
    domModule?: dom5.Node;
    scriptElement?: dom5.Node;
    pseudo: boolean;
    abstract?: boolean;
    constructor(options: Options);
    addProperty(prop: ScannedPolymerProperty): void;
    addMethod(method: ScannedMethod): void;
    resolve(document: Document): PolymerElement;
}
export interface PolymerExtension extends ElementBase {
    properties: PolymerProperty[];
    methods: Method[];
    observers: {
        javascriptNode: estree.Expression | estree.SpreadElement;
        expression: LiteralValue;
        parsedExpression: JavascriptDatabindingExpression | undefined;
    }[];
    listeners: {
        event: string;
        handler: string;
    }[];
    behaviorAssignments: ScannedBehaviorAssignment[];
    domModule?: dom5.Node;
    scriptElement?: dom5.Node;
    localIds: LocalId[];
    abstract?: boolean;
    emitPropertyMetadata(property: PolymerProperty): any;
}
export declare class PolymerElement extends Element implements PolymerExtension {
    properties: PolymerProperty[];
    methods: Method[];
    observers: Observer[];
    listeners: {
        event: string;
        handler: string;
    }[];
    behaviorAssignments: ScannedBehaviorAssignment[];
    domModule?: dom5.Node;
    scriptElement?: dom5.Node;
    localIds: LocalId[];
    abstract?: boolean;
    constructor();
    emitPropertyMetadata(property: PolymerProperty): {
        polymer: any;
    };
}
export declare function getBehaviors(behaviorAssignments: ScannedBehaviorAssignment[], document: Document): {
    behaviors: Set<Behavior>;
    warnings: Warning[];
};
