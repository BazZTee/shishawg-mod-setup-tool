function prioritizeExactCategory(categories, query) {
  if (!Array.isArray(categories)) return [];

  const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
  if (!normalizedQuery) return categories.slice();

  const exactMatches = [];
  const otherMatches = [];

  categories.forEach(category => {
    const normalizedName = String(category?.name || '').trim().toLocaleLowerCase();
    if (normalizedName === normalizedQuery) {
      exactMatches.push(category);
    } else {
      otherMatches.push(category);
    }
  });

  return exactMatches.concat(otherMatches);
}

module.exports = { prioritizeExactCategory };
