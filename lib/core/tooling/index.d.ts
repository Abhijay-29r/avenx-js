// Type definitions for Avenx-JS build-time tooling
// Import from 'avenx-core/tooling'. Node only: these helpers read from disk.

export interface InvalidComponentTagIssue {
    tagName: string;
    expectedName: string;
    index: number;
}

export function componentNameFromFile(fileName: string): string;
export function findRegisteredComponents(projectRoot: string, componentsDir?: string): Set<string>;
export function extractLintableTemplate(source: string): string;
export function findInvalidComponentTags(source: string, registeredComponents: Set<string>): InvalidComponentTagIssue[];
export function findProjectRoot(filePath: string, fallbackRoot: string): string;

/** ESLint rule that flags component tags whose casing does not match the file. */
export const componentTagNamingRule: {
    meta: Record<string, any>;
    create(context: any): Record<string, any>;
};

/** ESLint parser that exposes the JavaScript regions of a component template. */
export const avenxTemplateParser: {
    parseForESLint(code: string, options?: any): any;
};
