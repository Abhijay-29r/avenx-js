import {
  findInvalidComponentTags,
  findProjectRoot,
  findRegisteredComponents,
  resolveComponentsDir,
} from './componentTagNaming.js';

export const componentTagNamingRule = {
  meta: {
    type: 'problem',

    docs: {
      description:
        'Require registered Avenx component tags to use PascalCase.',
    },

    schema: [
      {
        type: 'object',
        properties: {
          componentsDir: {
            type: 'string',
          },

          componentNames: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        additionalProperties: false,
      },
    ],

    messages: {
      invalidName:
        'Avenx component <{{tagName}}> must use PascalCase: <{{expectedName}}>.',
    },
  },

  create(context) {
    const physicalFilename = context.physicalFilename;
    const options = context.options[0] || {};
    const sourceCode = context.sourceCode;

    return {
      Program() {
        const source = sourceCode.getText();

        let registeredComponents;

        if (Array.isArray(options.componentNames)) {
          registeredComponents = new Set(options.componentNames);
        } else {
          const projectRoot = findProjectRoot(
            physicalFilename,
            context.cwd,
          );

          registeredComponents = findRegisteredComponents(
            projectRoot,
            resolveComponentsDir(
              projectRoot,
              options.componentsDir,
            ),
          );
        }

        for (const issue of findInvalidComponentTags(
          source,
          registeredComponents,
        )) {
          const lineStart =
            source.lastIndexOf('\n', issue.index - 1) + 1;

          const line =
            source.slice(0, issue.index)
              .split(/\r\n|\r|\n/)
              .length;

          const column = issue.index - lineStart;

          context.report({
            loc: {
              start: {
                line,
                column,
              },
              end: {
                line,
                column: column + issue.tagName.length,
              },
            },

            messageId: 'invalidName',

            data: {
              tagName: issue.tagName,
              expectedName: issue.expectedName,
            },
          });
        }
      },
    };
  },
};