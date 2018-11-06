import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { chain, createLexer, createParser, many, matchTokenType, optional, plus, sqlParser } from '../src';

const myLexer = createLexer([
  {
    type: 'whitespace',
    regexes: [/^(\s+)/],
    ignore: true
  },
  {
    type: 'word',
    regexes: [/^([a-zA-Z0-9]+)/] // 解析数字
  },
  {
    type: 'operator',
    regexes: [
      /^(\(|\))/, // 解析 ( )
      /^(,)/
    ]
  }
]);

const root = () => chain('select', many('a'))();

const myParser = createParser(
  root, // Root grammar.
  myLexer // Created in lexer example.
);

class Props {}

class State {}

const mockAsyncParser = async (text: string, index: number) => {
  return Promise.resolve().then(() => sqlParser(text, index));
};

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  private currentParserPromise: any = null;
  private editVersion = 0;

  public componentDidMount() {
    setTimeout(() => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.create(ReactDOM.findDOMNode(this), {
        language: 'sql'
      });
      editor.layout({
        width: 1000,
        height: 500
      });

      editor.setValue(`select a, b, c, d from e`);

      editor.onDidChangeModelContent((event: any) => {
        this.editVersion++;
        const currentEditVersion = this.editVersion;

        this.currentParserPromise = new Promise(resolve => {
          setTimeout(() => {
            const model = editor.getModel();

            mockAsyncParser(editor.getValue(), model.getOffsetAt(editor.getPosition())).then(astResult => {
              // tslint:disable-next-line:no-console
              console.log('-----------------');
              // tslint:disable-next-line:no-console
              console.log(astResult);

              resolve(astResult);

              if (currentEditVersion !== this.editVersion) {
                return;
              }

              if (astResult.error) {
                const newReason =
                  astResult.error.reason === 'incomplete'
                    ? `Incomplete, expect next input: \n${astResult.error.suggestions
                        .map((each: any) => each.value)
                        .join('\n')}`
                    : `Wrong input, expect: \n${astResult.error.suggestions.map((each: any) => each.value).join('\n')}`;

                const errorPosition = astResult.error.token
                  ? {
                      startLineNumber: model.getPositionAt(astResult.error.token.position[0]).lineNumber,
                      startColumn: model.getPositionAt(astResult.error.token.position[0]).column,
                      endLineNumber: model.getPositionAt(astResult.error.token.position[1]).lineNumber,
                      endColumn: model.getPositionAt(astResult.error.token.position[1]).column + 1
                    }
                  : {
                      startLineNumber: 0,
                      startColumn: 0,
                      endLineNumber: 0,
                      endColumn: 0
                    };

                model.getPositionAt(astResult.error.token);

                monaco.editor.setModelMarkers(model, 'sql', [
                  {
                    ...errorPosition,
                    message: newReason,
                    severity: monaco.Severity.Error
                  }
                ]);
              } else {
                monaco.editor.setModelMarkers(editor.getModel(), 'sql', []);
              }
            });
          });
        });
      });

      monaco.languages.registerCompletionItemProvider('sql', {
        // tslint:disable-next-line:no-invalid-template-strings
        triggerCharacters: ' ${}.:=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
        provideCompletionItems: async () => {
          const currentEditVersion = this.editVersion;
          const astResult = await this.currentParserPromise;

          if (currentEditVersion !== this.editVersion) {
            return [];
          }

          return astResult.nextMatchings.map((matching: any) => ({
            label: matching.value
          }));
        }
      });
    }, 2000);
  }

  public render() {
    return <div />;
  }
}
