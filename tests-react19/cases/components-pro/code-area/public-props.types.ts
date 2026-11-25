import type { Editor } from 'codemirror';
import type { CodeAreaProps } from 'choerodon-ui/pro/lib/code-area/interface';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type MountArgs = Parameters<NonNullable<CodeAreaProps['editorDidMount']>>;
export const mountSignature: Equal<MountArgs, [Editor, string, () => void]> = true;

export const props: CodeAreaProps = {
  options: { lineNumbers: true, customAddonOption: 'enabled' },
  formatHotKey: 'Ctrl-F',
  unFormatHotKey: 'Ctrl-R',
  formatter: { getFormatted: text => text.trim(), getRaw: text => text },
  editorDidMount(editor, value, cb) {
    const previous: string = editor.getValue();
    editor.setValue(value);
    editor.getDoc().setValue(previous);
    cb();
  },
};
