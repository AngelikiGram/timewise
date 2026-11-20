// Starting points for the four ways in, beyond the prebuilt collection. These are only names to look up:
// each is matched live on Wikidata when chosen (a person by name and birth years, a thing or an event by its
// best search match), and the page shows what was matched. No fact here is shown as a fact.

/** Name, earliest and latest birth year to accept, and an era for grouping. */
export type FeaturedPerson = { name: string; from: number; to: number; era: Era };
export type Era = "antiquity" | "middle-ages" | "early-modern" | "long-19th" | "world-wars" | "since-1945";
export const ERA_LABEL: Record<Era, string> = { antiquity: "Antiquity", "middle-ages": "Middle Ages", "early-modern": "1450–1800", "long-19th": "1800–1914", "world-wars": "1914–1945", "since-1945": "Since 1945" };

const P = (era: Era, list: [string, number, number?][]): FeaturedPerson[] => list.map(([name, from, to]) => ({ name, from, to: to ?? from, era }));

export const FEATURED_PEOPLE: FeaturedPerson[] = [
  ...P("antiquity", [["Confucius", -552, -550], ["Socrates", -471, -469], ["Aristotle", -385, -383], ["Alexander the Great", -357, -355], ["Archimedes", -288, -286], ["Julius Caesar", -101, -99], ["Cleopatra", -70, -68], ["Augustus", -64, -62], ["Hypatia", 350, 375]]),
  ...P("middle-ages", [["Charlemagne", 740, 750], ["Avicenna", 978, 982], ["Murasaki Shikibu", 970, 980], ["Hildegard of Bingen", 1097, 1099], ["Eleanor of Aquitaine", 1120, 1124], ["Saladin", 1136, 1138], ["Genghis Khan", 1155, 1167], ["Marco Polo", 1253, 1255], ["Dante Alighieri", 1264, 1266], ["Mansa Musa", 1270, 1290], ["Ibn Battuta", 1303, 1305], ["Joan of Arc", 1411, 1413], ["Johannes Gutenberg", 1393, 1406]]),
  ...P("early-modern", [["Christopher Columbus", 1450, 1452], ["Leonardo da Vinci", 1452], ["Nicolaus Copernicus", 1473], ["Michelangelo", 1475], ["Martin Luther", 1483], ["Suleiman the Magnificent", 1494, 1495], ["Elizabeth I", 1533], ["Akbar", 1542], ["Tokugawa Ieyasu", 1542, 1543], ["William Shakespeare", 1564], ["Galileo Galilei", 1564], ["Johannes Kepler", 1571], ["Artemisia Gentileschi", 1593], ["Rembrandt", 1606], ["Isaac Newton", 1642, 1643], ["Johann Sebastian Bach", 1685], ["Voltaire", 1694], ["Benjamin Franklin", 1706], ["Émilie du Châtelet", 1706], ["Frederick the Great", 1712], ["Maria Theresa", 1717], ["Catherine the Great", 1729], ["Joseph Haydn", 1732], ["George Washington", 1732], ["Johann Wolfgang von Goethe", 1749], ["Wolfgang Amadeus Mozart", 1756], ["Hokusai", 1760]]),
  ...P("long-19th", [["Napoleon", 1769], ["Alexander von Humboldt", 1769], ["Ludwig van Beethoven", 1770], ["Jane Austen", 1775], ["Simón Bolívar", 1783], ["Franz Schubert", 1797], ["Giuseppe Garibaldi", 1807], ["Charles Darwin", 1809], ["Abraham Lincoln", 1809], ["Ada Lovelace", 1815], ["Otto von Bismarck", 1815], ["Karl Marx", 1818], ["Frederick Douglass", 1817, 1818], ["Queen Victoria", 1819], ["Florence Nightingale", 1820], ["Harriet Tubman", 1815, 1825], ["Johann Strauss II", 1825], ["Leo Tolstoy", 1828], ["Franz Joseph I of Austria", 1830], ["Emily Dickinson", 1830], ["Mark Twain", 1835], ["Empress Elisabeth of Austria", 1837], ["Claude Monet", 1840], ["Pyotr Ilyich Tchaikovsky", 1840], ["Thomas Edison", 1847], ["Vincent van Gogh", 1853], ["Nikola Tesla", 1856], ["Rabindranath Tagore", 1861], ["Marie Curie", 1867]]),
  ...P("world-wars", [["Mahatma Gandhi", 1869], ["Winston Churchill", 1874], ["Albert Einstein", 1879], ["Pablo Picasso", 1881], ["Stefan Zweig", 1881], ["Virginia Woolf", 1882], ["Emmy Noether", 1882], ["Franz Kafka", 1883], ["Coco Chanel", 1883], ["Erwin Schrödinger", 1887], ["Charlie Chaplin", 1889], ["Ludwig Wittgenstein", 1889], ["Amelia Earhart", 1897], ["Ernest Hemingway", 1899], ["Louis Armstrong", 1901], ["Kurt Gödel", 1906], ["Frida Kahlo", 1907], ["Simone de Beauvoir", 1908], ["Hedy Lamarr", 1914], ["Anne Frank", 1929]]),
  ...P("since-1945", [["Mother Teresa", 1910], ["Bruno Kreisky", 1911], ["Alan Turing", 1912], ["Rosa Parks", 1913], ["John F. Kennedy", 1917], ["Indira Gandhi", 1917], ["Nelson Mandela", 1918], ["Katherine Johnson", 1918], ["Rosalind Franklin", 1920], ["Marilyn Monroe", 1926], ["Martin Luther King Jr.", 1929], ["Audrey Hepburn", 1929], ["Neil Armstrong", 1930], ["Yuri Gagarin", 1934], ["Jane Goodall", 1934], ["Elvis Presley", 1935], ["Valentina Tereshkova", 1937], ["Wangari Maathai", 1940], ["Muhammad Ali", 1942], ["Stephen Hawking", 1942]]),
];

/** Things to follow, by the words to search Wikidata for. */
export const FEATURED_THINGS: { search: string; hint: string }[] = [
  { search: "Gothic architecture", hint: "cathedrals and town halls" }, { search: "Baroque architecture", hint: "palaces and churches" },
  { search: "Romanesque architecture", hint: "round arches, thick walls" }, { search: "Art Deco", hint: "the 1920s and 30s" },
  { search: "Brutalist architecture", hint: "concrete, after 1950" }, { search: "Bauhaus", hint: "a school and a style" },
  { search: "lighthouse", hint: "along every coast" }, { search: "windmill", hint: "grinding and pumping" },
  { search: "castle", hint: "fortified homes" }, { search: "astronomical observatory", hint: "watching the sky" },
  { search: "opera house", hint: "music for the city" }, { search: "suspension bridge", hint: "spanning rivers" },
  { search: "skyscraper", hint: "cities going up" }, { search: "synagogue", hint: "places of worship" },
  { search: "mosque", hint: "places of worship" }, { search: "abbey", hint: "monastic life" },
  { search: "botanical garden", hint: "plants from everywhere" }, { search: "Impressionism", hint: "painters, by birthplace" },
  { search: "Cubism", hint: "painters, by birthplace" }, { search: "psychoanalysis", hint: "people, by birthplace" },
  { search: "Surrealism", hint: "artists, by birthplace" }, { search: "Ferris wheel", hint: "fairground giants" },
];

/** Events to tell as a story, by the words to search Wikidata for. */
export const FEATURED_EVENTS: string[] = [
  "Peloponnesian War", "Punic Wars", "Crusades", "Black Death", "Hundred Years' War", "Fall of Constantinople", "Age of Discovery",
  "Reformation", "Thirty Years' War", "Battle of Vienna", "Industrial Revolution", "American Revolution", "French Revolution",
  "Haitian Revolution", "Napoleonic Wars", "Congress of Vienna", "Revolutions of 1848", "Taiping Rebellion", "Meiji Restoration",
  "Austro-Prussian War", "World War I", "Russian Revolution", "Mexican Revolution", "Great Depression", "Spanish Civil War",
  "World War II", "Partition of India", "Cold War", "Space Race", "Apollo 11", "Fall of the Berlin Wall", "Chernobyl disaster",
];

export const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
export const findHref = (p: FeaturedPerson) => `/explore/life?find=${encodeURIComponent(p.name)}&from=${p.from}&to=${p.to}`;
