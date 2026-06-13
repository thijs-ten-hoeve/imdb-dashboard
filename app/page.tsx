"use client"
import * as React from "react"
import { Inter, JetBrains_Mono } from "next/font/google"
import Image from "next/image"
import {
  Calendar, Layers, DollarSign, Clapperboard, Clock,
  UserCheck, Search, X, Check, ChevronDown, Star, ExternalLink,
  ArrowUp, ArrowDown, ArrowUpDown, TrendingUp, Info, Pencil
} from "lucide-react"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts"

import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { genreNl } from "@/lib/genres-nl"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

const sansFont = Inter({ subsets: ["latin"], variable: "--font-sans" })
const monoFont = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

// --- TMDB Configuratie & Avatar Component ---
const TMDB_API_KEY = "ce19ec38146a5d1bf2a186ae9a5f582d"

function TmdbAvatar({ name, initials }: { name: string; initials: string }) {
  const [imgUrl, setImgUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cacheKey = `tmdb_avatar_${name.replace(/\s+/g, '_')}`
    const cached = sessionStorage.getItem(cacheKey)
    
    if (cached) {
      if (cached !== "null") setImgUrl(cached)
      return
    }

    async function fetchImage() {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(name)}&api_key=${TMDB_API_KEY}&include_adult=false`)
        if (!res.ok) return
        
        const data = await res.json()
        if (data.results && data.results.length > 0 && data.results[0].profile_path) {
          const path = `https://image.tmdb.org/t/p/w200${data.results[0].profile_path}`
          setImgUrl(path)
          sessionStorage.setItem(cacheKey, path)
        } else {
          sessionStorage.setItem(cacheKey, "null")
        }
      } catch (error) {
        console.error("Fout bij ophalen TMDB afbeelding:", error)
      }
    }
    
    fetchImage()
  }, [name])

  if (imgUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imgUrl} alt={name} className="object-cover w-full h-full" />
  }
  
  return <>{initials}</>
}
// --------------------------------------------

type SortField = "name" | "budget" | "winst"
type SortDirection = "asc" | "desc"

function SortIcon({ field, activeField, direction }: { field: SortField; activeField: SortField; direction: SortDirection }) {
  if (field !== activeField) return <ArrowUpDown size={12} className="text-slate-300" />
  return direction === "asc"
    ? <ArrowUp size={12} className="text-amber-600" />
    : <ArrowDown size={12} className="text-amber-600" />
}

// Types
interface MovieData {
  id: string
  title: string
  genre: string
  type: string
  year: number
  budget: number
  isAdultClassification: boolean
  durationMinutes: number
  baseMarginFactor: number
  imdbRating: number
}

interface DirectorInfo {
  id?: string
  name: string
  initials: string
  bio: string
  genre?: string
  score?: number
  birthYear?: number | null
  deathYear?: number | null
  filmCount?: number
  avgProfitM?: number
  avgRating?: number | null
}

interface ActorInfo {
  id: string
  name: string
  initials: string
  score: number
  genre: string
  birthYear: number | null
  deathYear: number | null
  bio: string
}

interface GenreInfo {
  name: string
  titleCount: number
  avgNetProfit: number
  avgMarginPct: number
}

function formatBudget(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return (m % 1 === 0 ? m.toString() : m.toFixed(1)) + 'M'
  }
  const k = value / 1_000
  return (k % 1 === 0 ? k.toString() : k.toFixed(1)) + 'K'
}

function parseBudget(input: string): number {
  const s = input.trim().toUpperCase().replace(/\s/g, '')
  if (s.endsWith('M')) {
    const n = parseFloat(s.slice(0, -1).replace(',', '.'))
    return isNaN(n) ? 0 : Math.round(n * 1_000_000)
  }
  if (s.endsWith('K')) {
    const n = parseFloat(s.slice(0, -1).replace(',', '.'))
    return isNaN(n) ? 0 : Math.round(n * 1_000)
  }
  return parseInt(s.replace(/\./g, '').replace(',', '.')) || 0
}

export default function CanaryDashboard() {
  // Data State
  const [masterCatalog, setMasterCatalog] = React.useState<MovieData[]>([])
  const [allActors, setAllActors] = React.useState<ActorInfo[]>([])
  const [genreActors, setGenreActors] = React.useState<ActorInfo[] | null>(null)
  const [genreStats, setGenreStats] = React.useState<GenreInfo[]>([])
  const [topDirectors, setTopDirectors] = React.useState<DirectorInfo[]>([])
  const [selectedSuitableDirectorId, setSelectedSuitableDirectorId] = React.useState<string | null>(null)
  
  // Laad States
  const [isInitialLoading, setIsInitialLoading] = React.useState(true) 
  const [isFiltering, setIsFiltering] = React.useState(false) 

  // Filter State
  const [productionType, setProductionType] = React.useState<string>("all")
  const [selectedGenre, setSelectedGenre] = React.useState<string | null>(null)
  const [budgetRange, setBudgetRange] = React.useState<[number, number]>([1_000_000, 1_000_000_000])
  const [budgetCeiling, setBudgetCeiling] = React.useState<number>(1_000_000_000)
  const [budgetInputMax, setBudgetInputMax] = React.useState<string>(formatBudget(1_000_000_000))
  const prevCatalogKey = React.useRef<string>('')
  const [yearRange, setYearRange] = React.useState<number[]>([1970, 2026])
  const [filmSearchQuery, setFilmSearchQuery] = React.useState<string>("")
  const [sortField, setSortField] = React.useState<SortField>("winst")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")
  const [filmPageSize, setFilmPageSize] = React.useState<number>(10)
  
  // UI State
  const [selectedActorFilter, setSelectedActorFilter] = React.useState<ActorInfo | null>(null)
  const [actorMovies, setActorMovies] = React.useState<any[]>([])
  const [isActorMoviesLoading, setIsActorMoviesLoading] = React.useState(false)

  const [actorSearchQuery, setActorSearchQuery] = React.useState<string>("")
  const [actorSearchResults, setActorSearchResults] = React.useState<ActorInfo[] | null>(null)
  const [isSearchingActors, setIsSearchingActors] = React.useState(false)

  const [popupContent, setPopupContent] = React.useState<{
    type: "actor" | "director"
    id?: string
    name: string
    initials: string
    genre: string
    score?: number
    birthYear?: number | null
    deathYear?: number | null
    bio: string
  } | null>(null)
  const [popupPosition, setPopupPosition] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const popupRef = React.useRef<HTMLDivElement>(null)

  const [showMoreActors, setShowMoreActors] = React.useState(false)
  const [moreActorsPosition, setMoreActorsPosition] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const moreActorsRef = React.useRef<HTMLDivElement>(null)
  const [expandedActorInDropdown, setExpandedActorInDropdown] = React.useState<string | null>(null)

  const [showMoreDirectors, setShowMoreDirectors] = React.useState(false)
  const [moreDirectorsPosition, setMoreDirectorsPosition] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const moreDirectorsRef = React.useRef<HTMLDivElement>(null)
  const [expandedDirectorInDropdown, setExpandedDirectorInDropdown] = React.useState<string | null>(null)

  const [showGenreDropdown, setShowGenreDropdown] = React.useState(false)
  const genreDropdownRef = React.useRef<HTMLDivElement>(null)
  const [selectedSuitableActorId, setSelectedSuitableActorId] = React.useState<string | null>(null)
  const [searchedSuitableActor, setSearchedSuitableActor] = React.useState<ActorInfo | null>(null)

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      try {
        const url = new URL('/api/genres', window.location.origin);
        url.searchParams.set('startYear', yearRange[0].toString());
        url.searchParams.set('endYear', yearRange[1].toString());

        const genresRes = await fetch(url.toString());
        if (genresRes.ok) {
          setGenreStats(await genresRes.json());
        }
      } catch (error) {
        console.error("Fout bij ophalen genres:", error);
      } finally {
        setIsInitialLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [yearRange]);

  React.useEffect(() => {
    let cancelled = false;

    function filterParams() {
      const p = new URLSearchParams();
      p.set('startYear', yearRange[0].toString());
      p.set('endYear',   yearRange[1].toString());
      p.set('minBudget', Math.round(budgetRange[0] / 1_000_000).toString());
      p.set('maxBudget', Math.round(budgetRange[1] / 1_000_000).toString());
      return p;
    }

    async function fetchActorsAndDirector() {
      const p = filterParams();

      if (selectedGenre) p.set('genre', selectedGenre);

      try {
        const actorsUrl = new URL('/api/actors', window.location.origin);
        actorsUrl.search = p.toString();
        const actorsRes = await fetch(actorsUrl.toString());
        if (actorsRes.ok && !cancelled) {
          const data = await actorsRes.json();
          if (selectedGenre) setGenreActors(data);
          else { setAllActors(data); setGenreActors(null); }
        }
      } catch (error) {
        console.error('Fout bij ophalen acteurs:', error);
      }

      const dp = filterParams();
      dp.set('limit', '8');
      if (selectedGenre) dp.set('genre', selectedGenre);
      try {
        const dirUrl = new URL('/api/directors', window.location.origin);
        dirUrl.search = dp.toString();
        const dirRes = await fetch(dirUrl.toString());
        if (dirRes.ok && !cancelled) {
          const data = await dirRes.json();
          setTopDirectors(data);
        }
      } catch (error) {
        console.error('Fout bij ophalen regisseur:', error);
      }
    }

    fetchActorsAndDirector();
    return () => { cancelled = true; };
  }, [selectedGenre, yearRange, budgetRange]);

  React.useEffect(() => {
    const query = actorSearchQuery.trim();
    if (query.length < 2) {
      setActorSearchResults(null);
      setIsSearchingActors(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearchingActors(true);
      try {
        const url = new URL('/api/actors', window.location.origin);
        url.searchParams.set('search', query);
        if (selectedGenre) url.searchParams.set('genre', selectedGenre);
        const res = await fetch(url.toString());
        if (res.ok) {
          setActorSearchResults(await res.json());
        }
      } catch (error) {
        console.error('Fout bij zoeken acteurs:', error);
      } finally {
        setIsSearchingActors(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [actorSearchQuery, selectedGenre]);

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      setIsFiltering(true);
      try {
        const url = new URL('/api/catalog', window.location.origin);
        url.searchParams.append('type', productionType);
        url.searchParams.append('genre', selectedGenre || 'all');
        url.searchParams.append('minBudget', Math.round(budgetRange[0] / 1_000_000).toString());
        url.searchParams.append('maxBudget', Math.round(budgetRange[1] / 1_000_000).toString());
        url.searchParams.append('startYear', yearRange[0].toString());
        url.searchParams.append('endYear', yearRange[1].toString());
        if (selectedActorFilter) {
          url.searchParams.append('talentId', selectedActorFilter.id);
        }

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Netwerk response was niet ok');
        
        const data = await res.json();
        const cleanMovies = data.map((item: any) => ({
          ...item,
          genre: item.genre || "Algemeen"
        }));
        setMasterCatalog(cleanMovies);

        const catalogKey = `${selectedGenre ?? 'all'}-${yearRange[0]}-${yearRange[1]}`;
        if (prevCatalogKey.current !== catalogKey) {
          prevCatalogKey.current = catalogKey;
          const top = [...cleanMovies].sort((a: any, b: any) =>
            (b.baseMarginFactor * b.budget) - (a.baseMarginFactor * a.budget)
          )[0];
          if (top?.budget > 0) {
            setBudgetCeiling(top.budget);
            setBudgetRange([1_000_000, top.budget]);
            setBudgetInputMax(formatBudget(top.budget));
          }
        }

      } catch (error) {
        console.error("Fout bij ophalen catalogus:", error);
      } finally {
        setIsFiltering(false);
      }
    }, 400); 

    return () => clearTimeout(delayDebounceFn);
  }, [productionType, selectedGenre, budgetRange, yearRange, selectedActorFilter]);

  React.useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setPopupContent(null)
      }
    }
    if (popupContent) document.addEventListener("click", handleOutsideClick)
    return () => document.removeEventListener("click", handleOutsideClick)
  }, [popupContent])

  React.useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (moreActorsRef.current && !moreActorsRef.current.contains(event.target as Node)) {
        setShowMoreActors(false)
        setActorSearchQuery("")
        setActorSearchResults(null)
        setExpandedActorInDropdown(null)
      }
    }
    if (showMoreActors) document.addEventListener("click", handleOutsideClick)
    return () => document.removeEventListener("click", handleOutsideClick)
  }, [showMoreActors])

  const toggleMoreActors = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()

    if (showMoreActors) {
      setShowMoreActors(false)
      return
    }

    const screenWidth = window.innerWidth
    let targetX = e.pageX + 10
    if (targetX + 280 > screenWidth) targetX = screenWidth - 300
    setMoreActorsPosition({ x: targetX, y: e.pageY + 10 })
    setPopupContent(null)
    setShowMoreActors(true)
  }

  React.useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (moreDirectorsRef.current && !moreDirectorsRef.current.contains(event.target as Node)) {
        setShowMoreDirectors(false)
        setExpandedDirectorInDropdown(null)
      }
    }
    if (showMoreDirectors) document.addEventListener("click", handleOutsideClick)
    return () => document.removeEventListener("click", handleOutsideClick)
  }, [showMoreDirectors])

  React.useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(event.target as Node)) {
        setShowGenreDropdown(false)
      }
    }
    if (showGenreDropdown) document.addEventListener("click", handleOutsideClick)
    return () => document.removeEventListener("click", handleOutsideClick)
  }, [showGenreDropdown])

  const toggleMoreDirectors = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()

    if (showMoreDirectors) {
      setShowMoreDirectors(false)
      return
    }

    const screenWidth = window.innerWidth
    let targetX = e.pageX + 10
    if (targetX + 280 > screenWidth) targetX = screenWidth - 300
    setMoreDirectorsPosition({ x: targetX, y: e.pageY + 10 })
    setPopupContent(null)
    setShowMoreDirectors(true)
  }

  const handleGenreChange = (genre: string | null) => {
    setBudgetRange([1_000_000, 1_000_000_000])
    setBudgetCeiling(1_000_000_000)
    setBudgetInputMax(formatBudget(1_000_000_000))
    setSelectedGenre(genre)
    setPopupContent(null)
    setShowMoreActors(false)
    setShowMoreDirectors(false)
    setSelectedActorFilter(null)
    setSelectedSuitableActorId(null)
    setSelectedSuitableDirectorId(null)
    setSearchedSuitableActor(null)
  }

  const selectActorSearchResult = (actor: ActorInfo) => {
    setSearchedSuitableActor(actor)
    setSelectedSuitableActorId(null)
    setActorSearchQuery("")
    setActorSearchResults(null)
    setShowMoreActors(false)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection(field === "name" ? "asc" : "desc")
    }
  }

  const rankedGenres = React.useMemo(() => {
    return genreStats
      .map((genre) => ({
        name: genre.name,
        titleCount: genre.titleCount,
        value: Math.round((genre.avgNetProfit / 1_000_000) * 10) / 10,
      }))
      .sort((a, b) => b.value - a.value)
  }, [genreStats])

  const processedAnalytics = React.useMemo(() => {
    const verifiedCatalog = masterCatalog.map(item => {
      let winstPercentage = Math.round(item.baseMarginFactor * 100)
      const omzet = Math.round(item.budget * (1 + (winstPercentage / 100)))
      const nettoWinst = omzet - item.budget

      return { ...item, winstPercentage, nettoWinst, isEligible: true }
    })

    const finalRankedCatalog = verifiedCatalog.sort((a, b) => b.winstPercentage - a.winstPercentage)
    const totalActive = finalRankedCatalog.length

    return { rankedMovies: finalRankedCatalog, titleCount: totalActive }
  }, [masterCatalog])

  const selectedGenreSummary = React.useMemo(() => {
    const effectiveGenre = selectedGenre || searchedSuitableActor?.genre || null
    if (!effectiveGenre) return null

    const matchedRankedGenre = rankedGenres.find((g) => g.name === effectiveGenre)
    const exactWinstM = matchedRankedGenre ? matchedRankedGenre.value : 0

    const movies = processedAnalytics.rankedMovies.filter((m) => m.genre === effectiveGenre)

    if (movies.length > 0) {
      const validDurationMovies = movies.filter(m => m.durationMinutes > 0)
      const totalDuration = validDurationMovies.reduce((sum, m) => sum + m.durationMinutes, 0)
      const validImdbMovies = movies.filter(m => m.imdbRating && !isNaN(Number(m.imdbRating)))
      const avgImdb = validImdbMovies.length > 0
        ? (validImdbMovies.reduce((sum, m) => sum + Number(m.imdbRating), 0) / validImdbMovies.length).toFixed(1)
        : "N/A"

      return {
        name: effectiveGenre,
        avgWinstM: exactWinstM,
        avgDuration: validDurationMovies.length > 0 ? Math.round(totalDuration / validDurationMovies.length) : null,
        titleCount: movies.length,
        avgImdb
      }
    }

    const stat = genreStats.find((g) => g.name === effectiveGenre)
    if (!stat || stat.titleCount === 0) return null

    return {
      name: effectiveGenre,
      avgWinstM: exactWinstM,
      avgDuration: null,
      titleCount: stat.titleCount,
      avgImdb: "N/A"
    }
  }, [selectedGenre, searchedSuitableActor, processedAnalytics.rankedMovies, genreStats, rankedGenres])

  const displayedMovies = React.useMemo(() => {
    const query = filmSearchQuery.toLowerCase().trim()
    let movies = query
      ? processedAnalytics.rankedMovies.filter(m => m.title.toLowerCase().includes(query))
      : processedAnalytics.rankedMovies

    const dir = sortDirection === "asc" ? 1 : -1
    return [...movies].sort((a, b) => {
      if (sortField === "name") return dir * a.title.localeCompare(b.title)
      if (sortField === "budget") return dir * (a.budget - b.budget)
      return dir * (a.nettoWinst - b.nettoWinst)
    })
  }, [processedAnalytics.rankedMovies, filmSearchQuery, sortField, sortDirection])

  const paginatedMovies = React.useMemo(
    () => displayedMovies.slice(0, filmPageSize),
    [displayedMovies, filmPageSize]
  )

  const geselecteerdeRegisseur = React.useMemo<DirectorInfo>(() => {
    if (selectedSuitableDirectorId) {
      const found = topDirectors.find(d => d.id === selectedSuitableDirectorId)
      if (found) return found
    }
    return topDirectors[0] ?? { name: "—", initials: "?", bio: "Laden..." }
  }, [topDirectors, selectedSuitableDirectorId])

  const rankedActeursVoorContext = React.useMemo<ActorInfo[]>(() => {
    const source = selectedGenre ? (genreActors ?? []) : allActors
    return [...source].sort((a, b) => b.score - a.score)
  }, [selectedGenre, genreActors, allActors])

  const geselecteerdeActeur = React.useMemo<ActorInfo | null>(() => {
    if (searchedSuitableActor) return searchedSuitableActor
    if (selectedSuitableActorId) {
      const gekozen = rankedActeursVoorContext.find(a => a.id === selectedSuitableActorId)
      if (gekozen) return gekozen
    }
    return rankedActeursVoorContext[0] ?? null
  }, [rankedActeursVoorContext, selectedSuitableActorId, searchedSuitableActor])

  const openContextPopup = (e: React.MouseEvent, type: "actor" | "director", data: ActorInfo | DirectorInfo) => {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    
    const screenWidth = window.innerWidth
    let targetX = e.pageX + 10
    if (targetX + 340 > screenWidth) targetX = screenWidth - 360
    setPopupPosition({ x: targetX, y: e.pageY - 20 })
    
    const scoreVal = "score" in data ? data.score : undefined
    const genreVal = "genre" in data && data.genre ? data.genre : (selectedGenre || "Algemeen")
    const idVal = "id" in data ? data.id : undefined
    const birthYearVal = "birthYear" in data ? data.birthYear : undefined
    const deathYearVal = "deathYear" in data ? data.deathYear : undefined

    setPopupContent({
      type,
      id: idVal,
      name: data.name,
      initials: data.initials,
      genre: genreVal,
      score: scoreVal,
      birthYear: birthYearVal,
      deathYear: deathYearVal,
      bio: data.bio
    })

    if (type === "actor" && idVal) {
      setActorMovies([])
      setIsActorMoviesLoading(true)
      fetch(`/api/actors/movies?talentId=${idVal}`)
        .then(res => {
          if (!res.ok) {
            return res.json().then(data => Promise.reject(new Error(data.error || "Fout bij ophalen")));
          }
          return res.json()
        })
        .then(data => {
          setActorMovies(data)
        })
        .catch(err => {
          console.error("Fout bij ophalen films van acteur:", err.message || err)
        })
        .finally(() => {
          setIsActorMoviesLoading(false)
        })
    }
  }


  // Generate chart data formatting
  const chartDataFilms = displayedMovies.slice(0, 12).map((m) => ({
    name: m.title.length > 12 ? m.title.substring(0, 12) + "..." : m.title,
    winst: Math.round(m.nettoWinst / 1_000_000),
    budget: Math.round(m.budget / 1_000_000)
  }));

  if (isInitialLoading) {
    return (
      <div className={`${sansFont.variable} font-sans flex h-screen w-full flex-col items-center justify-center bg-slate-50`}>
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="p-5 bg-gradient-to-br from-amber-400 to-amber-500 rounded-3xl shadow-xl shadow-amber-500/20 ring-1 ring-amber-400">
            <Clapperboard size={40} className="text-slate-950 animate-pulse" />
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-xs font-extrabold tracking-[0.2em] text-slate-800 uppercase">
              Database Indexeren
            </h2>
            <div className="w-56 h-1.5 bg-slate-200/80 rounded-full overflow-hidden shadow-inner relative">
              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-amber-600 w-full animate-[pulse_1.5s_ease-in-out_infinite] origin-left scale-x-50"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${sansFont.variable} ${monoFont.variable} font-sans flex min-h-screen w-full bg-slate-50/50 text-slate-900 antialiased relative selection:bg-indigo-500/30 ${isFiltering ? 'opacity-70 grayscale-[20%] transition-all duration-300' : 'opacity-100 transition-all duration-300'}`}>
      
      {/* 1. Vaste Linker Sidebar voor Filters */}
      <aside className="w-[320px] shrink-0 bg-white/80 backdrop-blur-xl border-r border-slate-200/80 p-6 flex flex-col gap-6 overflow-y-auto h-screen sticky top-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-22 h-22 shrink-0 rounded-xl overflow-hidden shadow-sm">
            <Image 
              src="/logo.png" 
              alt="CanaryDB Logo" 
              width={88}
              height={88}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-900">Canary Productions</h2>
            <p className="text-slate-500 text-[11px] font-medium tracking-wide uppercase mt-0.5">Prestatiepredictor</p>
          </div>
        </div>


        {/* Type Media Filter */}
        <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:border-slate-300/80">
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-amber-500" /> Type Media
            </label>
          </div>
          <Select value={productionType} onValueChange={setProductionType}>
            <SelectTrigger className="bg-white border-slate-200 text-slate-800 h-10 text-xs rounded-xl shadow-sm hover:border-indigo-400 focus:ring-indigo-500/20">
              <SelectValue placeholder="Selecteer Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Vormen</SelectItem>
              <SelectItem value="movie">Speelfilms</SelectItem>
              <SelectItem value="tvSeries">Televisieseries</SelectItem>
              <SelectItem value="documentary">Documentaires</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Genre Filter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Kies een genre</span>
            {selectedGenre && (
              <button onClick={() => handleGenreChange(null)} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-md font-bold hover:bg-amber-200 transition-colors">
                Reset Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {rankedGenres.map((genreItem) => {
              const isSelected = genreItem.name === selectedGenre
              return (
                <button
                  key={genreItem.name}
                  onClick={() => handleGenreChange(isSelected ? null : genreItem.name)}
                  className={`p-3 rounded-xl text-xs text-center transition-all duration-300 active:scale-95 border ${
                    isSelected
                      ? "bg-amber-50 border-amber-300 text-amber-900 font-bold shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-amber-200 hover:shadow-sm hover:text-slate-800"
                  }`}
                >
                  <span className="block truncate">{genreNl(genreItem.name)}</span>
                  <span className={`text-[11px] font-mono block mt-1 ${isSelected ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                    {genreItem.titleCount > 0 ? `€${genreItem.value.toFixed(1)}M gem.` : "—"}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sliders Container */}
        <div className="space-y-4 pt-2">
          <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:border-slate-300/80">
            <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <DollarSign size={14} className="text-amber-500" /> Investeringsbudget
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1 text-[11px] font-bold text-indigo-700 font-mono bg-white rounded-md border border-indigo-100 shadow-sm overflow-hidden">
                <span className="pl-2 text-slate-400">€</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetInputMax}
                  onChange={(e) => setBudgetInputMax(e.target.value)}
                  onBlur={(e) => {
                    const val = Math.max(1_000_000, parseBudget(e.target.value))
                    setBudgetRange([1_000_000, val])
                    setBudgetInputMax(formatBudget(val))
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  className="w-full pr-2 py-0.5 text-right bg-transparent focus:outline-none"
                />
              </div>
            </div>
            <Slider
              value={[budgetRange[1]]}
              onValueChange={(val) => {
                setBudgetRange([1_000_000, val[0]])
                setBudgetInputMax(formatBudget(val[0]))
              }}
              min={1_000_000}
              max={budgetCeiling}
              step={1_000_000}
              className="cursor-grab"
            />
          </div>

          <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:border-slate-300/80">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Calendar size={14} className="text-amber-500" /> Periode
              </label>
              <span className="text-[11px] font-bold text-slate-700 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">
                {yearRange[0]} - {yearRange[1]}
              </span>
            </div>
            <Slider value={yearRange} onValueChange={(val) => {
                setBudgetRange([1_000_000, 1_000_000_000])
                setBudgetCeiling(1_000_000_000)
                setBudgetInputMax(formatBudget(1_000_000_000))
                setYearRange(val)
              }} min={1970} max={2026} step={1} className="cursor-grab" />
          </div>
        </div>
      </aside>

      {/* 2. Rechter Canvas voor Inhoud */}
      <section className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto max-w-full w-full z-10 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        
        {(selectedGenreSummary || searchedSuitableActor || geselecteerdeActeur) && (
          <div className="bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 border border-indigo-200/80 p-6 rounded-3xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            {selectedGenreSummary && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-bold text-indigo-700/80 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-500" /> Genre
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">{genreNl(selectedGenreSummary.name)}</h2>
                  <span className="text-[11px] text-slate-500 font-medium mt-2 flex items-center gap-2">
                    <span>Overzicht van prestaties & statistieken</span>
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-nowrap gap-3 items-center overflow-x-auto pb-0.5 min-w-0">
              {selectedGenreSummary && (
                <>
                  <div className="bg-white/90 border border-indigo-100 rounded-2xl px-4 py-2.5 shadow-sm shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wide">Gem. winst</p>
                    <p className="text-xl font-extrabold text-indigo-600 font-mono mt-0.5">€{selectedGenreSummary.avgWinstM}M</p>
                  </div>
                  <div className="bg-white/90 border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wide">Gem. duur</p>
                    <p className="text-xl font-extrabold text-slate-800 font-mono mt-0.5">
                      {selectedGenreSummary.avgDuration != null ? `${selectedGenreSummary.avgDuration} min` : "—"}
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center gap-1 p-2.5 pr-3 bg-white/80 border border-indigo-200/60 rounded-2xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all duration-300 group w-max shrink-0">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-10 h-10 bg-indigo-950 text-white rounded-xl flex items-center justify-center font-bold font-mono shadow-md group-hover:scale-105 group-hover:rotate-3 transition-transform overflow-hidden">
                    <TmdbAvatar name={geselecteerdeRegisseur.name} initials={geselecteerdeRegisseur.initials} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider flex items-center gap-1 mb-0.5">
                      <UserCheck size={12} className="text-indigo-500" /> Geschikte regisseur
                    </p>
                    <h4 className="text-sm font-extrabold text-slate-800">{geselecteerdeRegisseur.name}</h4>
                  </div>
                </div>
                {topDirectors.length > 1 && (
                  <button
                    onClick={toggleMoreDirectors}
                    title="Wijzig geschikte regisseur"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors shrink-0 ${showMoreDirectors ? "bg-indigo-950 border-indigo-950 text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300"}`}
                  >
                    <Pencil size={12} /> Verander
                  </button>
                )}
              </div>

              {geselecteerdeActeur && (
                <div className="flex items-center gap-1 p-2.5 pr-3 bg-white/80 border border-indigo-200/60 rounded-2xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all duration-300 group w-max shrink-0">
                  <button onClick={(e) => openContextPopup(e, "actor", geselecteerdeActeur)} className="flex items-center gap-3 pr-2 text-left">
                    <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center font-bold font-mono shadow-md group-hover:scale-105 group-hover:rotate-3 transition-transform overflow-hidden">
                      <TmdbAvatar name={geselecteerdeActeur.name} initials={geselecteerdeActeur.initials} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider flex items-center gap-1 mb-0.5">
                        <Star size={12} className="text-indigo-500" /> Geschikte acteur
                      </p>
                      <h4 className="text-sm font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {geselecteerdeActeur.name}
                      </h4>
                    </div>
                  </button>
                  {rankedActeursVoorContext.length > 1 && (
                    <button
                      onClick={toggleMoreActors}
                      title="Wijzig geschikte acteur"
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors shrink-0 ${showMoreActors ? "bg-indigo-950 border-indigo-950 text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300"}`}
                    >
                      <Pencil size={12} /> Verander
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics & Grafieken Sectie */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          
          {/* Grafiek 1: Winst per Genre */}
          <Card className="bg-white border-slate-200/80 shadow-sm rounded-3xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-500" /> Winst per Genre (Miljoen)
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankedGenres.slice(0, 10)} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <defs>
                    <linearGradient id="colorGenreWinst" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#4338ca" stopOpacity={0.9}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    angle={-25}
                    textAnchor="end"
                    height={40}
                    tickFormatter={(val) => genreNl(val)}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => `€${val}M`} />
                  <RechartsTooltip 
                    cursor={{ fill: '#f8fafc' }} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} 
                    formatter={(value: any) => [`€${value}M`, 'Gem. Winst']}
                  />
                  <Bar dataKey="value" fill="url(#colorGenreWinst)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Grafiek 2: Top Films Bar Chart (Budget vs Winst) - GESTAPELD */}
          <Card className="bg-white border-slate-200/80 shadow-sm rounded-3xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clapperboard size={16} className="text-indigo-500" /> Top Films: Budget vs Winst
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataFilms} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <defs>
                    <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.9}/>
                    </linearGradient>
                    <linearGradient id="colorWinst" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.9}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    angle={-25} 
                    textAnchor="end" 
                    height={40} 
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => `€${val}M`} />
                  <RechartsTooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} 
                    formatter={(value: any, name: any) => [`€${value}M`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />
                  <Bar dataKey="budget" name="Budget" stackId="a" fill="url(#colorBudget)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="winst" name="Netto Winst" stackId="a" fill="url(#colorWinst)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Films Ranglijst Tabel */}
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-3xl overflow-hidden w-full relative min-h-[300px]">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clapperboard size={16} className="text-indigo-500" /> 
                {selectedActorFilter 
                  ? `Films met ${selectedActorFilter.name}` 
                  : selectedGenre 
                    ? `Toplijst: ${selectedGenre}` 
                    : "Best scorende films"
                }
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-slate-500 font-medium">
                  {selectedActorFilter 
                    ? `Gefilterd op de filmografie van ${selectedActorFilter.name}.` 
                    : "Op basis van budget/winst."
                  }
                </span>
                {selectedActorFilter && (
                  <button 
                    onClick={() => setSelectedActorFilter(null)} 
                    className="text-[10px] bg-red-50 text-red-700 hover:bg-red-100 px-2 py-0.5 rounded-md font-bold border border-red-200/50 flex items-center gap-0.5 transition-colors"
                  >
                    Reset Filter <X size={10} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="relative w-52 group">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  type="text"
                  placeholder="Zoek film..."
                  value={filmSearchQuery}
                  onChange={(e) => setFilmSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9 bg-white border-slate-200 rounded-xl focus-visible:ring-indigo-500/20 focus-visible:border-indigo-400 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 shadow-sm">
                <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">Resultaten weergeven :</span>
                {([10, 50, 200] as const).map((size, i) => (
                  <React.Fragment key={size}>
                    {i > 0 && <span className="text-slate-300 text-xs">/</span>}
                    <button
                      onClick={() => setFilmPageSize(size)}
                      className={`text-xs font-bold font-mono transition-all ${filmPageSize === size ? "text-slate-900" : "text-slate-400 hover:text-slate-700"}`}
                    >
                      {size}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-2 border-b border-slate-100 bg-white hidden sm:grid sm:grid-cols-[28px_1fr_200px_88px] sm:gap-4 sm:items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">#</span>
            <button
              type="button"
              onClick={() => toggleSort("name")}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wide hover:text-indigo-600 transition-colors text-left"
            >
              Titel
              <SortIcon field="name" activeField={sortField} direction={sortDirection} />
            </button>
            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => toggleSort("budget")}
                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wide hover:text-indigo-600 transition-colors"
              >
                Budget
                <SortIcon field="budget" activeField={sortField} direction={sortDirection} />
              </button>
              <button
                type="button"
                onClick={() => toggleSort("winst")}
                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wide hover:text-indigo-600 transition-colors"
              >
                Winst
                <SortIcon field="winst" activeField={sortField} direction={sortDirection} />
              </button>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono text-right">Actie</span>
          </div>

          <div className="flex sm:hidden gap-2 px-5 py-2 border-b border-slate-100 bg-slate-50/50">
            {([
              { field: "name" as const, label: "Naam" },
              { field: "budget" as const, label: "Budget" },
              { field: "winst" as const, label: "Winst" },
            ]).map(({ field, label }) => (
              <button
                key={field}
                type="button"
                onClick={() => toggleSort(field)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono uppercase border transition-colors ${
                  sortField === field
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                {label}
                <SortIcon field={field} activeField={sortField} direction={sortDirection} />
              </button>
            ))}
          </div>
          
          <div className="p-3 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {paginatedMovies.length > 0 ? (
              <div className="space-y-2.5">
                {paginatedMovies.map((movie, index) => {
                  const liveImdbRating = movie.imdbRating && !isNaN(Number(movie.imdbRating))
                    ? Number(movie.imdbRating).toFixed(1)
                    : null
                  const compactBudget = `€${(movie.budget / 1000000).toFixed(1)}M`
                  const compactProfit = `€${(movie.nettoWinst / 1000000).toFixed(1)}M`

                  return (
                    <div key={movie.id} className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col group ${movie.genre === selectedGenre ? "border-indigo-200/60 bg-indigo-50/30 hover:border-indigo-300" : "border-slate-200/60 bg-white hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5"}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex gap-4 truncate items-start">
                          <span className="text-xs font-bold text-slate-400 font-mono pt-1 min-w-[24px]">#{index + 1}</span>
                          <div className="truncate">
                            <a
                              href={`https://www.imdb.com/title/${movie.id}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-extrabold text-slate-900 truncate group-hover:text-indigo-600 transition-colors block"
                            >
                              {movie.title}
                            </a>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">{genreNl(movie.genre)}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{movie.year}</span>
                              <span className="text-[11px] text-slate-400">·</span>
                              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-0.5"><Clock size={9} /> {movie.durationMinutes} min</span>
                              {liveImdbRating && (
                                <a
                                  href={`https://www.imdb.com/title/${movie.id}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 ml-0.5"
                                >
                                  <span style={{ background: '#F5C518', fontFamily: '"Arial Black", Arial, sans-serif', letterSpacing: '-0.2px' }} className="inline-block text-black font-black text-[10px] leading-none px-1 py-[2px] rounded-[3px]">
                                    IMDb
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-700">{liveImdbRating}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                          <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                            <div className="flex items-center gap-2 font-mono flex-wrap justify-end">
                              <span className="text-xs font-extrabold text-slate-700">{compactBudget}</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-sm font-black text-indigo-600">+{movie.winstPercentage}%</span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                                +{compactProfit}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-16 text-center text-sm text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center gap-3">
                <Search size={24} className="text-slate-300" /> {filmSearchQuery.trim() ? "Geen films gevonden voor deze zoekopdracht." : "Geen resultaten gevonden voor deze database filtercombinatie."}
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* Popups (Context en Video) */}
      {popupContent && (
        <div ref={popupRef} className="absolute w-[340px] bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200 p-6 shadow-2xl z-[60] animate-in fade-in zoom-in-95 duration-200" style={{ top: popupPosition.y, left: popupPosition.x }}>
           <div className="flex items-center justify-between border-b border-slate-100 pb-4">
             <div className="flex items-center gap-3.5 truncate">
               <div className={`w-20 h-20 rounded-2xl flex items-center justify-center font-extrabold text-lg shadow-inner shrink-0 border overflow-hidden ${popupContent.type === 'director' ? 'bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-indigo-950' : 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-500'}`}>
                 <TmdbAvatar name={popupContent.name} initials={popupContent.initials} />
               </div>
               <div className="truncate">
                 <h3 className="font-extrabold text-slate-900 truncate text-base">{popupContent.name}</h3>
                 <div className="flex gap-2 mt-1 flex-wrap">
                   <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">{popupContent.genre}</span>
                   {popupContent.type === "actor" && <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1"><Star size={10} className="fill-emerald-600 text-emerald-600" /> {popupContent.score}</span>}
                   {popupContent.birthYear && (
                     <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200/60 flex items-center gap-1">
                       {popupContent.deathYear
                         ? `${popupContent.birthYear} – ${popupContent.deathYear} (${popupContent.deathYear - popupContent.birthYear} jr)`
                         : `${popupContent.birthYear} · ${new Date().getFullYear() - popupContent.birthYear} jaar`
                       }
                     </span>
                   )}
                 </div>
               </div>
             </div>
             <button onClick={() => setPopupContent(null)} className="text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-xl"><X size={16}/></button>
           </div>
           <div className="pt-4">
             <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">{popupContent.bio}</p>
           </div>
           {popupContent.type === "actor" && (
             <div className="mt-4 pt-4 border-t border-slate-100">
               <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                 <span>Top Producties</span>
                 {isActorMoviesLoading && <span className="text-[10px] text-slate-400 lowercase font-normal animate-pulse">laden...</span>}
               </h4>
               {isActorMoviesLoading ? (
                 <div className="space-y-2">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse w-full"></div>
                   ))}
                 </div>
               ) : actorMovies.length > 0 ? (
                 <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                   {actorMovies.map(movie => (
                     <div key={movie.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                       <div className="truncate pr-2 max-w-[200px]">
                         <span className="font-bold text-slate-800 truncate block">{movie.title}</span>
                         <span className="text-[10px] text-slate-400 font-mono">{movie.year} · {movie.genre}</span>
                       </div>
                       <span className="text-amber-600 font-extrabold flex items-center gap-0.5 font-mono bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded-md shrink-0">
                         <Star size={10} className="fill-current" /> {movie.imdbRating ? movie.imdbRating.toFixed(1) : 'N/A'}
                       </span>
                     </div>
                   ))}
                 </div>
               ) : (
                 <p className="text-[11px] text-slate-400 italic">Geen producties gevonden.</p>
               )}
               
               <button
                 onClick={() => {
                   setSelectedActorFilter(
                     allActors.find(a => a.id === popupContent.id) || {
                       id: popupContent.id!,
                       name: popupContent.name,
                       initials: popupContent.initials,
                       score: popupContent.score || 0,
                       genre: popupContent.genre,
                       bio: popupContent.bio,
                       birthYear: null,
                       deathYear: null,
                     }
                   );
                   setPopupContent(null);
                 }}
                 className="mt-3.5 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
               >
                 <Search size={13} /> Toon films in hoofdlijst
               </button>
             </div>
           )}
        </div>
      )}

      {showMoreActors && (
        <div ref={moreActorsRef} className="absolute w-[280px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200 p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200" style={{ top: moreActorsPosition.y, left: moreActorsPosition.x }}>
          <p className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider px-1 pb-2 mb-2 border-b border-slate-100">
            Top acteurs{selectedGenre ? ` · ${genreNl(selectedGenre)}` : ""}
          </p>

          {/* Zoekbalk */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={selectedGenre ? `Zoek in ${genreNl(selectedGenre)}...` : "Zoek acteur..."}
              value={actorSearchQuery}
              onChange={(e) => setActorSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          {/* Zoekresultaten of top-lijst */}
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {actorSearchQuery.trim().length >= 2 ? (
              isSearchingActors ? (
                <div className="p-3 text-[11px] text-slate-400 text-center">Zoeken...</div>
              ) : actorSearchResults && actorSearchResults.length > 0 ? (
                actorSearchResults.slice(0, 8).map((acteur) => (
                  <button
                    key={acteur.id}
                    onClick={() => selectActorSearchResult(acteur)}
                    className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-indigo-50 transition-colors text-left group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-extrabold font-mono text-[10px] shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                      <TmdbAvatar name={acteur.name} initials={acteur.initials} />
                    </div>
                    <div className="truncate flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{acteur.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{genreNl(acteur.genre)}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 shrink-0">{acteur.score}</span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-[11px] text-slate-400 text-center">Geen acteurs gevonden.</div>
              )
            ) : (
              rankedActeursVoorContext.slice(0, 8).map((acteur, i) => {
                const isGekozen = geselecteerdeActeur?.id === acteur.id
                const isExpanded = expandedActorInDropdown === acteur.id
                return (
                  <div key={acteur.id} className="rounded-xl overflow-hidden">
                    <div
                      className={`w-full flex items-center gap-2.5 p-1.5 transition-colors group cursor-pointer ${isExpanded ? "bg-indigo-50" : isGekozen ? "bg-indigo-50" : "hover:bg-indigo-50"}`}
                      onClick={() => setExpandedActorInDropdown(isExpanded ? null : acteur.id)}
                    >
                      <span className="text-[10px] font-bold text-slate-400 font-mono w-4 text-right shrink-0">{i + 1}</span>
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-extrabold font-mono text-[10px] shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                        <TmdbAvatar name={acteur.name} initials={acteur.initials} />
                      </div>
                      <span className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors flex-1">{acteur.name}</span>
                      {isGekozen && !isExpanded && <Check size={14} className="text-indigo-600 shrink-0" />}
                      <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-2 bg-indigo-50/70 border-t border-indigo-100 space-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-indigo-200 text-indigo-900 border border-indigo-300 flex items-center justify-center font-extrabold font-mono text-sm shrink-0 overflow-hidden">
                            <TmdbAvatar name={acteur.name} initials={acteur.initials} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800">{acteur.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{genreNl(acteur.genre)}{acteur.birthYear ? ` · ${acteur.birthYear}` : ""}</p>
                          </div>
                          <span className="ml-auto text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shrink-0">{acteur.score}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{acteur.bio}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSearchedSuitableActor(null); setSelectedSuitableActorId(acteur.id); setExpandedActorInDropdown(null); setShowMoreActors(false) }}
                          className="w-full py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                          {isGekozen ? "Geselecteerd" : "Selecteer"}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {showMoreDirectors && (
        <div ref={moreDirectorsRef} className="absolute w-[280px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200 p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200" style={{ top: moreDirectorsPosition.y, left: moreDirectorsPosition.x }}>
          <p className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider px-1 pb-2 mb-2 border-b border-slate-100">
            Top regisseurs{selectedGenre ? ` · ${genreNl(selectedGenre)}` : ""}
          </p>
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {topDirectors.map((regisseur, i) => {
              const isGekozen = geselecteerdeRegisseur?.id === regisseur.id
              const isExpanded = expandedDirectorInDropdown === regisseur.id
              return (
                <div key={regisseur.id} className="rounded-xl overflow-hidden">
                  <div
                    className={`w-full flex items-center gap-2.5 p-1.5 transition-colors group cursor-pointer ${isExpanded ? "bg-indigo-50" : isGekozen ? "bg-indigo-50" : "hover:bg-indigo-50"}`}
                    onClick={() => setExpandedDirectorInDropdown(isExpanded ? null : regisseur.id ?? null)}
                  >
                    <span className="text-[10px] font-bold text-slate-400 font-mono w-4 text-right shrink-0">{i + 1}</span>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-extrabold font-mono text-[10px] shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                      <TmdbAvatar name={regisseur.name} initials={regisseur.initials} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors flex-1">{regisseur.name}</span>
                    {isGekozen && !isExpanded && <Check size={14} className="text-indigo-600 shrink-0" />}
                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 bg-indigo-50/70 border-t border-indigo-100 space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-200 text-indigo-900 border border-indigo-300 flex items-center justify-center font-extrabold font-mono text-sm shrink-0 overflow-hidden">
                          <TmdbAvatar name={regisseur.name} initials={regisseur.initials} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800">{regisseur.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{regisseur.birthYear ? `Geboren ${regisseur.birthYear}` : ""}
                          {regisseur.score != null && <span> · Score {regisseur.score}</span>}</p>
                        </div>
                        {regisseur.score != null && (
                          <span className="ml-auto text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shrink-0">{regisseur.score}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{regisseur.bio}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedSuitableDirectorId(regisseur.id ?? null); setExpandedDirectorInDropdown(null); setShowMoreDirectors(false) }}
                        className="w-full py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                      >
                        {isGekozen ? "Geselecteerd" : "Selecteer"}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}