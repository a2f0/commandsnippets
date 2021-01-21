const tasks = (arr) => arr.join(' && ')

module.exports = {
  hooks: {
    'pre-commit': tasks([
      'npm audit',
      'eslint -f tap .',
      'pre-commit run --all-files'
    ]),
  },
}
