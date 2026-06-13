const GENRE_NL: Record<string, string> = {
  Action: "Actie",
  Adventure: "Avontuur",
  Animation: "Animatie",
  Biography: "Biografie",
  Comedy: "Komedie",
  Crime: "Misdaad",
  Documentary: "Documentaire",
  Drama: "Drama",
  Family: "Familie",
  Fantasy: "Fantasie",
  "Film-Noir": "Film Noir",
  History: "Geschiedenis",
  Horror: "Horror",
  Music: "Muziek",
  Musical: "Musical",
  Mystery: "Mystery",
  Romance: "Romantiek",
  "Sci-Fi": "Sci-Fi",
  Sport: "Sport",
  Thriller: "Thriller",
  War: "Oorlog",
  Western: "Western",
}

export function genreNl(name: string): string {
  return GENRE_NL[name] ?? name
}
