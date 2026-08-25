// Type definitions for Avenx-JS testing utilities
// Import from 'avenx-core/testing'.

import { AvenxComponent } from './index.js';

export interface MockBridgeStateChange {
    prop: string;
    value: any;
}

export interface MockBridgeCall {
    method: string;
    args: any[];
}

export type MockBridge<T> = T & {
    $calls: MockBridgeCall[];
    $stateChanges: MockBridgeStateChange[];
    $onStateChange(cb: (prop: string, value: any) => void): () => void;
    $onCall(cb: (method: string, args: any[]) => void): () => void;
    $reset(): void;
    readonly $isMock: true;
};

export class AvenxMock {
    static createMockBridge<T extends object>(
        bridgeClassOrObject: T | (new (...args: any[]) => T),
        initialData?: Partial<T> | Record<string, any>
    ): MockBridge<T>;

    static createSandbox(): AvenxSandbox;

    static createMockRouter(options?: {
        currentRoute?: { hash?: string; page?: string; params?: Record<string, any> };
        hash?: string;
        page?: string;
        params?: Record<string, any>;
        queryParams?: Record<string, any>;
        guards?: Array<
            | ((to: any, from: any) => boolean | string | void)
            | { canActivate: (to: any, from: any) => boolean | string | void }
        >;
    }): {
        currentRoute: { hash: string; page: string; params: Record<string, any> };
        push(path: string): boolean;
        replace(path: string): boolean;
        getParams(): Record<string, any>;
        $calls: Array<{ method: string; args: any[]; blocked?: boolean }>;
        $reset(): void;
        readonly $isMock: true;
    };

    static trigger(element: any, eventName: string, eventData?: Record<string, any>): void;

    static mountTestComponent<C extends AvenxComponent<any> = AvenxComponent<any>>(
        ComponentClass: new (...args: any[]) => C,
        options?: MountTestComponentOptions
    ): Promise<MountTestComponentResult<C>>;

    static fireEvent(
        element: any,
        eventType: string,
        detail?: Record<string, any>
    ): Promise<void>;

    static flushPromises(): Promise<void>;
}

export interface MountTestComponentOptions {
    props?: Record<string, any>;
    slots?: Record<string, any> | string | any;
    state?: Record<string, any>;
    initialState?: Record<string, any>;
    bridges?: Record<string, any>;
    components?: Record<string, typeof AvenxComponent>;
    container?: any;
    route?: Record<string, any>;
}

export interface MountTestComponentResult<C = AvenxComponent<any>> {
    instance: C;
    component: C;
    element: any;
    container: any;
    update(): void;
    unmount(): void;
    readonly html: string;
    find(selector: string): any | null;
    findAll(selector: string): any[];
    findComponent(ComponentClassOrName: any): AvenxComponent<any> | null;
    trigger(selectorOrEl: any, eventName: string, detail?: Record<string, any>): Promise<void>;
}

export function mountTestComponent<C extends AvenxComponent<any> = AvenxComponent<any>>(
    ComponentClass: new (...args: any[]) => C,
    options?: MountTestComponentOptions
): Promise<MountTestComponentResult<C>>;

export function fireEvent(
    element: any,
    eventType: string,
    detail?: Record<string, any>
): Promise<void>;

export function flushPromises(): Promise<void>;

export class AvenxSandbox {
    components: Map<string, typeof AvenxComponent>;
    bridges: Record<string, any>;
    constructor();
    register(name: string, compClass: typeof AvenxComponent): this;
    registerBridge(name: string, bridgeInstance: any): this;
    setRoute(route: { hash?: string; page?: string; params?: Record<string, any> }): this;
    waitForUpdate(): Promise<void>;
    mount(
        compClass: typeof AvenxComponent,
        props?: Record<string, any>,
        container?: any
    ): {
        instance: AvenxComponent<any>;
        container: any;
        readonly html: string;
        update(): void;
        trigger(selectorOrElement: any, eventName: string, eventData?: Record<string, any>): void;
    };
}
