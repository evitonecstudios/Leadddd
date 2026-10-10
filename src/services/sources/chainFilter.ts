/**
 * ChainFilter: Detects and filters out multinational corporations, 
 * famous retail chains, corporate franchises, and non-commercial public bodies 
 * so that discovery yields genuine independent local shops & SMBs.
 */

export class ChainFilter {
  // Common corporate brands, retail chains, fast-food franchises, and multinational conglomerates
  private static readonly KNOWN_CHAINS: string[] = [
    // Electronics, Books & Multimedia
    'fnac', 'darty', 'boulanger', 'apple store', 'apple', 'mediamarkt', 'best buy',
    'micromania', 'nature & decouvertes', 'nature et decouvertes', 'cultura', 'ldlc',

    // Supermarkets & Hypermarkets & Convenience Stores
    'carrefour', 'carrefour market', 'carrefour city', 'carrefour express', 'carrefour contact',
    'monoprix', 'monop', "monop'", 'auchan', 'leclerc', 'e.leclerc', 'intermarche', 'intermarché',
    'casino', 'super u', 'hyper u', 'u express', 'franprix', 'lidl', 'aldi', 'cora', 'match',
    'walmart', 'target', 'tesco', 'sainsbury', 'marks & spencer', 'costco', 'migros', 'coop',
    'denner', 'spar', 'spar express', 'seven eleven', '7-eleven', 'carrefour bio',

    // Fast Food, Coffee & Casual Dining Chains
    'mcdonald', "mcdonald's", 'mcdo', 'burger king', 'kfc', 'subway', 'starbucks',
    'domino', "domino's", 'pizza hut', 'five guys', 'chipotle', 'paul', 'brioche doree', 'brioche dorée',
    'columbus cafe', 'columbus café', 'pret a manger', 'prêt à manger', 'costa coffee', 'dunkin',
    'o\'tacos', 'otacos', 'pitaya', 'quick', 'buffalo grill', 'courtepaille', 'la boucherie',
    'hippopotamus', 'flunch', 'del arte', 'pizza del arte', 'vapiano', 'nando', "nando's",

    // Fashion, Footwear & Apparel Chains
    'zara', 'h&m', 'h & m', 'mango', 'bershka', 'pull&bear', 'pull and bear', 'stradivarius',
    'primark', 'uniqlo', 'celio', 'jules', 'brice', 'etam', 'calzedonia', 'intimissimi',
    'tezenis', 'kiabi', 'gemo', 'gémo', 'la halle', 'promod', 'gap', "levi's", 'levis',
    'foot locker', 'courir', 'snipes', 'jd sports', 'decathlon', 'intersport', 'go sport',
    'pimkie', 'jennyfer', 'undiz', 'petit bateau', 'okaidi', 'okaïdi', 'sergent major',

    // Beauty, Cosmetics & Perfumery
    'sephora', 'marionnaud', 'yves rocher', 'nocibe', 'nocibé', 'kiko milano', 'kiko',
    "l'occitane", 'loccitane', 'the body shop', 'lush', 'mac cosmetics', 'ritual', 'rituals',

    // Home, DIY & Furniture
    'ikea', 'leroy merlin', 'castorama', 'brico depot', 'brico dépôt', 'bricorama', 'mr bricolage',
    'conforama', 'but', 'maisons du monde', 'habitat', 'alinea', 'alinéa', 'saint maclou',

    // Telecom & Tech Operators
    'orange', 'sfr', 'bouygues telecom', 'bouygues', 'free center', 'free mobile',
    'vodafone', 'o2', 't-mobile', 'at&t', 'verizon', 'swisscom', 'sunrise', 'salt store',

    // Banks & Financial Institutions
    'bnp paribas', 'societe generale', 'société générale', 'credit agricole', 'crédit agricole',
    'lcl', 'caisse d\'epargne', 'caisse d\'épargne', 'banque populaire', 'credit mutuel', 'crédit mutuel',
    'cic', 'axa', 'allianz', 'groupama', 'macif', 'maif', 'matmut', 'ubs', 'credit suisse', 'postfinance',
    'santander', 'bbva', 'hsbc', 'barclays', 'deutsche bank',

    // Fuel & Automotive Service Chains
    'total', 'totalenergies', 'shell', 'bp', 'esso', 'repsol', 'eni', 'norauto', 'feu vert',
    'midas', 'speedy', 'point s', 'carglass', 'euromaster', 'avis', 'hertz', 'sixt', 'europcar',

    // Eyewear Chains
    'optical center', 'alain afflelou', 'afflelou', 'krys', 'grandoptical', 'atol',
    "generale d'optique", "générale d'optique", 'optique 2000',

    // Frozen Food & Specialty Chain Retail
    'picard', 'naturalia', 'biocoop', 'bio c\' bon', 'bio c bon', 'la vie claire',

    // Bakery Chains
    'marie blachere', 'marie blachère', 'boulangerie ange', 'ange', 'la mie caline', 'la mie câline',
    'feuillette', 'boulangerie feuillette', 'louise', 'boulangerie louise',

    // Fitness & Gym Chains
    'basic fit', 'basic-fit', 'fitness park', 'keep cool', 'neoness', 'on air fitness',
    'l\'orange bleue', 'orange bleue', 'magic form',

    // Hair Salon Chains
    'franck provost', 'jean louis david', 'saint algue', 'shampoo expert', 'coiff&co', 'tchip', 'tchip coiffure', 'camille albane',

    // Healthcare & Pharmacy Franchises
    'pharmacie lafayette', 'optique lafayette', 'dentego', 'point vision', 'vertuo',

    // Hotel & Hospitality Chains
    'ibis', 'ibis budget', 'ibis styles', 'novotel', 'mercure', 'sofitel', 'marriott',
    'hilton', 'best western', 'b&b hotels', 'premiere classe', 'première classe',
    'campanile', 'kyriad', 'f1 hotel', 'hotel f1', 'radisson', 'sheraton', 'holiday inn'
  ];

  /**
   * Evaluates whether an OSM entity or raw lead represents a major corporate chain or famous multinational place.
   */
  static isChainOrMajorBrand(tags: Record<string, any>, name?: string): boolean {
    if (!tags) tags = {};

    // 1. Direct OpenStreetMap Chain/Brand tags
    if (tags.brand || tags['brand:wikidata'] || tags['brand:wikipedia']) {
      return true;
    }

    if (tags.chain === 'yes' || tags.franchise === 'yes') {
      return true;
    }

    if (tags.network && typeof tags.network === 'string' && tags.network.length > 2) {
      return true;
    }

    // 2. Check Corporate Operator Tag
    if (tags.operator && typeof tags.operator === 'string') {
      const op = tags.operator.toLowerCase();
      for (const chain of this.KNOWN_CHAINS) {
        if (op.includes(chain)) return true;
      }
    }

    // 3. Name Checking against Known Chains
    const businessName = (name || tags.name || '').toLowerCase().trim();
    if (!businessName) return false;

    // Normalize accents and punctuation for robust matching
    const cleanBusinessName = businessName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, '');

    for (const chain of this.KNOWN_CHAINS) {
      const cleanChain = chain
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['’]/g, '');

      // Match full word or prefix
      const regex = new RegExp(`(^|\\s|[^a-z0-9])${cleanChain}($|\\s|[^a-z0-9])`, 'i');
      if (regex.test(cleanBusinessName) || cleanBusinessName.startsWith(cleanChain + ' ') || cleanBusinessName === cleanChain) {
        return true;
      }
    }

    // 4. Exclude Public institutions, stations, and non-SMB amenities if tagged
    if (tags.amenity === 'police' || tags.amenity === 'fire_station' || tags.amenity === 'embassy' ||
        tags.amenity === 'courthouse' || tags.amenity === 'townhall' || tags.public_transport) {
      return true;
    }

    return false;
  }
}
