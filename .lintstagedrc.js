module.exports = {
  '*.{ts}': ['eslint --fix', 'prettier --write'],
  '*.{js}': (filenames) =>
    filenames
      .filter((filename) => !filename.includes('/scripts/'))
      .map((filename) => [`eslint --fix ${filename}`, `prettier --write ${filename}`])
      .flat(),
  '*.{json,md,yml,yaml}': ['prettier --write'],
};