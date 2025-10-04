import Prism from 'prismjs';

import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-elixir';
import 'prismjs/components/prism-erlang';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-groovy';
import 'prismjs/components/prism-haskell';
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-latex';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-makefile';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-matlab';
import 'prismjs/components/prism-objectivec';
import 'prismjs/components/prism-perl';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-php-extras';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-properties';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sass';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-shell-session';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-yaml';

const aliasMap: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  yml: 'yaml',
  gql: 'graphql',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  shellsession: 'shell-session',
  shell_session: 'shell-session',
  ps1: 'powershell',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  objc: 'objectivec',
  'objective-c': 'objectivec',
  'c++': 'cpp',
  cplusplus: 'cpp',
  cxx: 'cpp',
  csharp: 'csharp',
  'c#': 'csharp',
  tex: 'latex',
  md: 'markdown',
  markdown: 'markdown',
  dockerfile: 'docker',
  gradle: 'groovy',
  env: 'properties',
  conf: 'properties',
  ini: 'ini',
  make: 'makefile',
  makefile: 'makefile',
  plain: 'none',
  plaintext: 'none',
  text: 'none',
  txt: 'none',
  jsonc: 'json',
  json5: 'json',
};

Object.entries(aliasMap).forEach(([alias, canonical]) => {
  if (Prism.languages[alias]) {
    return;
  }

  const language = Prism.languages[canonical];
  if (language) {
    Prism.languages[alias] = language;
  }
});
