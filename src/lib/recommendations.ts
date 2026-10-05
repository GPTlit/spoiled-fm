import type { VideoResult } from "@/components/DiscoverSearch";

export interface CuratedRecommendation extends VideoResult {
  category: "Trending" | "Pop" | "Hip-Hop" | "R&B" | "Electronic" | "Rock" | "Acoustic" | "Chill";
  tag?: string;
}

export const CURATED_RECOMMENDATIONS: CuratedRecommendation[] = [
  // Pop
  {
    id: "kPqg7K7U1Lw",
    title: "Espresso",
    channel: "Sabrina Carpenter",
    duration: "3:20",
    thumbnail: "https://i.ytimg.com/vi/kPqg7K7U1Lw/hqdefault.jpg",
    views: "240M views",
    category: "Pop",
    tag: "Summer Anthem",
  },
  {
    id: "kPa7bsKwL-8",
    title: "Die With A Smile",
    channel: "Lady Gaga & Bruno Mars",
    duration: "4:12",
    thumbnail: "https://i.ytimg.com/vi/kPa7bsKwL-8/hqdefault.jpg",
    views: "310M views",
    category: "Pop",
    tag: "Top Global Hit",
  },
  {
    id: "T62mEIOfw8Q",
    title: "Taste",
    channel: "Sabrina Carpenter",
    duration: "3:15",
    thumbnail: "https://i.ytimg.com/vi/T62mEIOfw8Q/hqdefault.jpg",
    views: "110M views",
    category: "Pop",
    tag: "Chart Topper",
  },
  {
    id: "1bZ0OSwd50g",
    title: "Good Luck, Babe!",
    channel: "Chappell Roan",
    duration: "3:38",
    thumbnail: "https://i.ytimg.com/vi/1bZ0OSwd50g/hqdefault.jpg",
    views: "95M views",
    category: "Pop",
    tag: "Viral Sensation",
  },
  {
    id: "suAR1PYFNYA",
    title: "Houdini",
    channel: "Dua Lipa",
    duration: "3:05",
    thumbnail: "https://i.ytimg.com/vi/suAR1PYFNYA/hqdefault.jpg",
    views: "130M views",
    category: "Pop",
    tag: "Club Groove",
  },
  {
    id: "q3zqJs7JUCQ",
    title: "Fortnight ft. Post Malone",
    channel: "Taylor Swift",
    duration: "4:09",
    thumbnail: "https://i.ytimg.com/vi/q3zqJs7JUCQ/hqdefault.jpg",
    views: "115M views",
    category: "Pop",
    tag: "TTPD",
  },
  {
    id: "s1A0T3oJt70",
    title: "Greedy",
    channel: "Tate McRae",
    duration: "2:12",
    thumbnail: "https://i.ytimg.com/vi/s1A0T3oJt70/hqdefault.jpg",
    views: "180M views",
    category: "Pop",
    tag: "Viral Pop",
  },
  {
    id: "ZmDBbnmKpqQ",
    title: "vampire",
    channel: "Olivia Rodrigo",
    duration: "3:40",
    thumbnail: "https://i.ytimg.com/vi/ZmDBbnmKpqQ/hqdefault.jpg",
    views: "145M views",
    category: "Pop",
    tag: "GUTS",
  },
  {
    id: "XoiOOiuH8iI",
    title: "Water",
    channel: "Tyla",
    duration: "3:20",
    thumbnail: "https://i.ytimg.com/vi/XoiOOiuH8iI/hqdefault.jpg",
    views: "210M views",
    category: "Pop",
    tag: "Afrobeats Global",
  },

  // Hip-Hop
  {
    id: "H58vbez_m4E",
    title: "Not Like Us",
    channel: "Kendrick Lamar",
    duration: "4:34",
    thumbnail: "https://i.ytimg.com/vi/H58vbez_m4E/hqdefault.jpg",
    views: "180M views",
    category: "Hip-Hop",
    tag: "Record Breaker",
  },
  {
    id: "tvTRZJ-4EyI",
    title: "HUMBLE.",
    channel: "Kendrick Lamar",
    duration: "3:04",
    thumbnail: "https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg",
    views: "980M views",
    category: "Hip-Hop",
    tag: "Hip-Hop Classic",
  },
  {
    id: "B9synWjqBn8",
    title: "FE!N ft. Playboi Carti",
    channel: "Travis Scott",
    duration: "3:12",
    thumbnail: "https://i.ytimg.com/vi/B9synWjqBn8/hqdefault.jpg",
    views: "120M views",
    category: "Hip-Hop",
    tag: "Utopia",
  },
  {
    id: "t7bQwwqW-Hc",
    title: "A Bar Song (Tipsy)",
    channel: "Shaboozey",
    duration: "2:51",
    thumbnail: "https://i.ytimg.com/vi/t7bQwwqW-Hc/hqdefault.jpg",
    views: "140M views",
    category: "Hip-Hop",
    tag: "#1 Billboard Hit",
  },

  // R&B / Soul
  {
    id: "m7FkZ_9pL1A",
    title: "Dancing in the Flames",
    channel: "The Weeknd",
    duration: "3:40",
    thumbnail: "https://i.ytimg.com/vi/m7FkZ_9pL1A/hqdefault.jpg",
    views: "45M views",
    category: "R&B",
    tag: "Hurry Up Tomorrow",
  },
  {
    id: "4NRXx6U8ABQ",
    title: "Blinding Lights",
    channel: "The Weeknd",
    duration: "4:20",
    thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg",
    views: "890M views",
    category: "R&B",
    tag: "All-Time Top Song",
  },
  {
    id: "PMivT7MJ41M",
    title: "That's What I Like",
    channel: "Bruno Mars",
    duration: "3:26",
    thumbnail: "https://i.ytimg.com/vi/PMivT7MJ41M/hqdefault.jpg",
    views: "2.2B views",
    category: "R&B",
    tag: "24K Magic",
  },
  {
    id: "LDY_Xyx_Rkg",
    title: "Snooze",
    channel: "SZA",
    duration: "3:21",
    thumbnail: "https://i.ytimg.com/vi/LDY_Xyx_Rkg/hqdefault.jpg",
    views: "195M views",
    category: "R&B",
    tag: "SOS",
  },
  {
    id: "uzS3WG6__G4",
    title: "Pink + White",
    channel: "Frank Ocean",
    duration: "3:04",
    thumbnail: "https://i.ytimg.com/vi/uzS3WG6__G4/hqdefault.jpg",
    views: "85M views",
    category: "R&B",
    tag: "Blonde",
  },
  {
    id: "r4l9bFqgMaQ",
    title: "Nights",
    channel: "Frank Ocean",
    duration: "5:07",
    thumbnail: "https://i.ytimg.com/vi/r4l9bFqgMaQ/hqdefault.jpg",
    views: "72M views",
    category: "R&B",
    tag: "Masterpiece",
  },
  {
    id: "GZ3zL7kT6_c",
    title: "Lose Control",
    channel: "Teddy Swims",
    duration: "3:30",
    thumbnail: "https://i.ytimg.com/vi/GZ3zL7kT6_c/hqdefault.jpg",
    views: "260M views",
    category: "R&B",
    tag: "Soul Sensation",
  },

  // Electronic
  {
    id: "5NV6Rdv1a3I",
    title: "Get Lucky",
    channel: "Daft Punk ft. Pharrell Williams",
    duration: "4:08",
    thumbnail: "https://i.ytimg.com/vi/5NV6Rdv1a3I/hqdefault.jpg",
    views: "780M views",
    category: "Electronic",
    tag: "RAM",
  },
  {
    id: "FGBhQbmMxH8",
    title: "One More Time",
    channel: "Daft Punk",
    duration: "5:21",
    thumbnail: "https://i.ytimg.com/vi/FGBhQbmMxH8/hqdefault.jpg",
    views: "510M views",
    category: "Electronic",
    tag: "Discovery",
  },
  {
    id: "34Na4j8AVgA",
    title: "Starboy ft. Daft Punk",
    channel: "The Weeknd",
    duration: "3:50",
    thumbnail: "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg",
    views: "2.3B views",
    category: "Electronic",
    tag: "Certified Diamond",
  },
  {
    id: "wuCK-oiE3rA",
    title: "Sunset Lover",
    channel: "Petit Biscuit",
    duration: "3:57",
    thumbnail: "https://i.ytimg.com/vi/wuCK-oiE3rA/hqdefault.jpg",
    views: "185M views",
    category: "Electronic",
    tag: "Chill Electro",
  },

  // Rock / Indie
  {
    id: "V9PVRfjEBTI",
    title: "BIRDS OF A FEATHER",
    channel: "Billie Eilish",
    duration: "3:13",
    thumbnail: "https://i.ytimg.com/vi/V9PVRfjEBTI/hqdefault.jpg",
    views: "120M views",
    category: "Rock",
    tag: "HIT ME HARD AND SOFT",
  },
  {
    id: "aezstCBHOPQ",
    title: "Too Sweet",
    channel: "Hozier",
    duration: "4:11",
    thumbnail: "https://i.ytimg.com/vi/aezstCBHOPQ/hqdefault.jpg",
    views: "140M views",
    category: "Rock",
    tag: "Global Rock",
  },
  {
    id: "MB3VkzPdgLA",
    title: "LUNCH",
    channel: "Billie Eilish",
    duration: "3:00",
    thumbnail: "https://i.ytimg.com/vi/MB3VkzPdgLA/hqdefault.jpg",
    views: "85M views",
    category: "Rock",
    tag: "Indie Groove",
  },
  {
    id: "XXYlFuWEuKI",
    title: "Save Your Tears",
    channel: "The Weeknd",
    duration: "3:36",
    thumbnail: "https://i.ytimg.com/vi/XXYlFuWEuKI/hqdefault.jpg",
    views: "1.1B views",
    category: "Rock",
    tag: "After Hours",
  },

  // Acoustic / Chill
  {
    id: "s_WpPll1m4c",
    title: "Birds of a Feather (Live Performance)",
    channel: "Billie Eilish",
    duration: "3:25",
    thumbnail: "https://i.ytimg.com/vi/V9PVRfjEBTI/hqdefault.jpg",
    views: "42M views",
    category: "Acoustic",
    tag: "Live Session",
  },
  {
    id: "UfcAVejslrU",
    title: "Weightless",
    channel: "Marconi Union",
    duration: "8:05",
    thumbnail:
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=640&auto=format&fit=crop&q=80",
    views: "42M views",
    category: "Chill",
    tag: "Ambient Therapy",
  },
  {
    id: "Wwz1q2R392U",
    title: "Coffee",
    channel: "beabadoobee",
    duration: "2:06",
    thumbnail:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=640&auto=format&fit=crop&q=80",
    views: "55M views",
    category: "Chill",
    tag: "Lo-Fi Morning",
  },
];

/**
 * Shuffles and returns a randomized subset of recommendation videos
 * filtered optionally by category/genre.
 */
export function getFreshRecommendations(category?: string, count = 8): CuratedRecommendation[] {
  let pool = [...CURATED_RECOMMENDATIONS];

  if (category && category !== "All") {
    const matched = pool.filter((item) => item.category.toLowerCase() === category.toLowerCase());
    if (matched.length > 0) {
      pool = matched;
    }
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}

export const DISCOVERY_SEARCH_PROMPTS = [
  "top trending music videos 2026",
  "viral songs billboard hot 100",
  "new music releases official",
  "lofi chill hip hop beats",
  "summer vibe acoustic sessions",
  "melodic electronic dance hits",
  "indie bedroom pop favorites",
  "r&b soul late night session",
];
