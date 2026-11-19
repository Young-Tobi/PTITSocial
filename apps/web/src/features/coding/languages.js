export const languages = [
  {
    key: 'c',
    label: 'C',
    editor: 'c',
    timeFactor: 1,
    starter:
      '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    // Viet loi giai cua ban o day\n    return 0;\n}\n',
  },
  {
    key: 'cpp',
    label: 'C++17',
    editor: 'cpp',
    timeFactor: 1,
    starter:
      '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // Viet loi giai cua ban o day\n    return 0;\n}\n',
  },
  {
    key: 'java',
    label: 'Java',
    editor: 'java',
    timeFactor: 2,
    starter:
      'import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        // Viet loi giai cua ban o day\n    }\n}\n',
  },
  {
    key: 'python',
    label: 'Python 3',
    editor: 'python',
    timeFactor: 3,
    starter:
      'import sys\n\ndef main():\n    # Viet loi giai cua ban o day\n    pass\n\nif __name__ == "__main__":\n    main()\n',
  },
];
export const getLanguage = (key) => languages.find((item) => item.key === key) || languages[1];
export const languageLabel = (key) => getLanguage(key).label;
export const supportedLanguages = 'C / C++ / Java / Python';
