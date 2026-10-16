"use client";

import React, { useState, useEffect, useMemo } from "react";
import { fetchApi } from "../../../lib/api";
import { formatRupees } from "../../../lib/utils";
import { PlayerIdentity } from "../../../components/auction/PlayerIdentity";
import { CountryFlag } from "../../../components/common/CountryFlag";
import { TeamIdentity } from "../../../components/teams/TeamIdentity";
import {
  Search,
  Upload,
  Plus,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  Plane,
  Loader2,
  Filter,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Shield,
  Award,
  Zap,
  BarChart3,
  TrendingUp,
  Tag,
} from "lucide-react";

const FRANCHISES = [
  { code: "CSK", name: "Chennai Super Kings" },
  { code: "DC", name: "Delhi Capitals" },
  { code: "GT", name: "Gujarat Titans" },
  { code: "KKR", name: "Kolkata Knight Riders" },
  { code: "LSG", name: "Lucknow Super Giants" },
  { code: "MI", name: "Mumbai Indians" },
  { code: "PBKS", name: "Punjab Kings" },
  { code: "RR", name: "Rajasthan Royals" },
  { code: "RCB", name: "Royal Challengers Bengaluru" },
  { code: "SRH", name: "Sunrisers Hyderabad" },
];

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedCountry, setSelectedCountry] = useState("ALL");
  const [selectedSet, setSelectedSet] = useState("ALL");
  const [selectedCap, setSelectedCap] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedFranchise, setSelectedFranchise] = useState("ALL");
  const [showRatings, setShowRatings] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals state
  const [viewingPlayer, setViewingPlayer] = useState<any | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSourceType, setImportSourceType] = useState<"URL" | "CSV" | "JSON">("CSV");
  const [csvContent, setCsvContent] = useState("");
  const [importUrl, setImportUrl] = useState("https://www.cricinfo.com/ipl-2026-auction-shortlist");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Player Form State (for both Add and Edit)
  const [playerForm, setPlayerForm] = useState({
    name: "",
    country: "India",
    isOverseas: false,
    role: "BATTER",
    battingStyle: "Right-hand bat",
    bowlingStyle: "Right-arm off break",
    basePrice: 20000000,
    matches: 45,
    runs: 1200,
    battingAverage: 32.5,
    strikeRate: 138.2,
    wickets: 0,
    economy: 0,
    isCapped: true,
    previousFranchise: "" as string | null,
    setId: "set_1",
    orderInSet: 1,
    hiddenRatingOverall: 82,
    hiddenRatingBatting: 84,
    hiddenRatingBowling: 45,
    hiddenRatingKeeping: 30,
    officialStatus: "" as string | undefined,
    officialTeam: "" as string | undefined,
    officialTeamCode: "" as string | undefined,
    officialPrice: 0 as number | undefined,
  });

  const loadPlayers = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (selectedRole !== "ALL") query.set("role", selectedRole);
    if (selectedCountry !== "ALL") query.set("country", selectedCountry);
    if (selectedSet !== "ALL") query.set("set", selectedSet);
    if (search.trim()) query.set("search", search.trim());

    fetchApi<{ players: any[] }>(`/api/admin/players?${query.toString()}`)
      .then((res) => {
        setPlayers(res.players || []);
        setCurrentPage(1);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchApi<{ sets: any[] }>("/api/admin/sets")
      .then((res) => setSets(res.sets || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [selectedRole, selectedCountry, selectedSet, search]);

  // Client-side additional filtering for fast UX
  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (selectedCap === "CAPPED" && !p.isCapped) return false;
      if (selectedCap === "UNCAPPED" && p.isCapped) return false;

      if (selectedStatus !== "ALL") {
        const statusUpper = (p.officialStatus || "").toUpperCase();
        if (selectedStatus === "SOLD" && statusUpper !== "SOLD") return false;
        if (selectedStatus === "RETAINED" && statusUpper !== "RETAINED") return false;
        if (selectedStatus === "UNSOLD" && statusUpper !== "UNSOLD") return false;
      }

      if (selectedFranchise !== "ALL") {
        const matchesPrev = p.previousFranchise === selectedFranchise;
        const matchesOff = p.officialTeamCode === selectedFranchise;
        if (!matchesPrev && !matchesOff) return false;
      }

      return true;
    });
  }, [players, selectedCap, selectedStatus, selectedFranchise]);

  // Pagination calculation
  const totalItems = filteredPlayers.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / (effectivePageSize || 1)));
  const startIndex = (currentPage - 1) * effectivePageSize;
  const endIndex = Math.min(startIndex + effectivePageSize, totalItems);
  const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);

  // Set lookup map
  const setsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of sets) {
      map.set(s.id, s);
    }
    return map;
  }, [sets]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let capped = 0;
    let uncapped = 0;
    let overseas = 0;
    let indian = 0;
    let sold = 0;
    let retained = 0;
    let unsold = 0;

    for (const p of players) {
      if (p.isCapped) capped++;
      else uncapped++;

      if (p.isOverseas) overseas++;
      else indian++;

      const st = (p.officialStatus || "").toUpperCase();
      if (st === "SOLD") sold++;
      else if (st === "RETAINED") retained++;
      else if (st === "UNSOLD") unsold++;
    }

    return { total: players.length, capped, uncapped, overseas, indian, sold, retained, unsold };
  }, [players]);

  const handleOpenAdd = () => {
    setPlayerForm({
      name: "",
      country: "India",
      isOverseas: false,
      role: "BATTER",
      battingStyle: "Right-hand bat",
      bowlingStyle: "Right-arm off break",
      basePrice: 20000000,
      matches: 45,
      runs: 1200,
      battingAverage: 32.5,
      strikeRate: 138.2,
      wickets: 0,
      economy: 0,
      isCapped: true,
      previousFranchise: null,
      setId: sets[0]?.id || "set_1",
      orderInSet: 1,
      hiddenRatingOverall: 82,
      hiddenRatingBatting: 84,
      hiddenRatingBowling: 45,
      hiddenRatingKeeping: 30,
      officialStatus: undefined,
      officialTeam: undefined,
      officialTeamCode: undefined,
      officialPrice: undefined,
    });
    setEditingPlayer(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingPlayer(p);
    setPlayerForm({
      name: p.name,
      country: p.country,
      isOverseas: p.isOverseas,
      role: p.role,
      battingStyle: p.battingStyle || "Right-hand bat",
      bowlingStyle: p.bowlingStyle || "None",
      basePrice: p.basePrice,
      matches: p.matches || 0,
      runs: p.runs || 0,
      battingAverage: p.battingAverage || 0,
      strikeRate: p.strikeRate || 0,
      wickets: p.wickets || 0,
      economy: p.economy || 0,
      isCapped: p.isCapped !== undefined ? p.isCapped : true,
      previousFranchise: p.previousFranchise || null,
      setId: p.setId || "set_1",
      orderInSet: p.orderInSet || 1,
      hiddenRatingOverall: p.hiddenRatingOverall || 75,
      hiddenRatingBatting: p.hiddenRatingBatting || 70,
      hiddenRatingBowling: p.hiddenRatingBowling || 70,
      hiddenRatingKeeping: p.hiddenRatingKeeping || 30,
      officialStatus: p.officialStatus,
      officialTeam: p.officialTeam,
      officialTeamCode: p.officialTeamCode,
      officialPrice: p.officialPrice,
    });
    setIsAddModalOpen(true);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlayer) {
        await fetchApi(`/api/admin/players/${editingPlayer.id}`, {
          method: "PUT",
          body: JSON.stringify(playerForm),
        });
        setStatusMessage(`Updated player '${playerForm.name}' successfully.`);
      } else {
        await fetchApi("/api/admin/players", {
          method: "POST",
          body: JSON.stringify(playerForm),
        });
        setStatusMessage(`Added new player '${playerForm.name}' to master registry.`);
      }
      setIsAddModalOpen(false);
      setTimeout(() => setStatusMessage(null), 3500);
      loadPlayers();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  const handleDeletePlayer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}' from the master player registry?`)) {
      return;
    }
    try {
      await fetchApi(`/api/admin/players/${id}`, { method: "DELETE" });
      setStatusMessage(`Deleted '${name}' from master registry.`);
      setTimeout(() => setStatusMessage(null), 3500);
      loadPlayers();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleRunImport = async () => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await fetchApi<{ result: any }>("/api/admin/import", {
        method: "POST",
        body: JSON.stringify({
          sourceType: importSourceType,
          csvContent: csvContent,
          url: importUrl,
        }),
      });
      setImportResult(res.result);
      setStatusMessage(`Imported ${res.result?.totalImported || 0} players successfully.`);
      setTimeout(() => setStatusMessage(null), 3500);
      loadPlayers();
    } catch (err: any) {
      alert("Import error: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl pb-16">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span>Player Master Registry & Dossier</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {metrics.total} REGISTERED PLAYERS
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete cricket career stats, capped badges, auction sets, RTM franchises, hidden AI ratings, and real IPL 2026 outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRatings(!showRatings)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors shadow-2xs"
          >
            {showRatings ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
            <span>{showRatings ? "Hide Hidden Ratings" : "Reveal Hidden Ratings"}</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Import Dataset</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Player</span>
          </button>
        </div>
      </div>

      {/* Metrics Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <div className="p-2.5 rounded-xl border border-border/80 bg-card/60">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Players</div>
          <div className="text-lg font-black text-foreground">{metrics.total}</div>
          <div className="text-[10px] text-muted-foreground">Master Database</div>
        </div>
        <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
          <div className="text-[10px] uppercase font-bold text-emerald-400">Capped Players</div>
          <div className="text-lg font-black text-emerald-400">{metrics.capped}</div>
          <div className="text-[10px] text-emerald-500/80">Intl Experience</div>
        </div>
        <div className="p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5">
          <div className="text-[10px] uppercase font-bold text-blue-400">Uncapped Talent</div>
          <div className="text-lg font-black text-blue-400">{metrics.uncapped}</div>
          <div className="text-[10px] text-blue-500/80">Domestic / Emerging</div>
        </div>
        <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="text-[10px] uppercase font-bold text-amber-400">Overseas Quota</div>
          <div className="text-lg font-black text-amber-400">{metrics.overseas}</div>
          <div className="text-[10px] text-amber-500/80">Non-Indian Players</div>
        </div>
        <div className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/5">
          <div className="text-[10px] uppercase font-bold text-purple-400">Real Retained</div>
          <div className="text-lg font-black text-purple-400">{metrics.retained}</div>
          <div className="text-[10px] text-purple-500/80">Official IPL 2026</div>
        </div>
        <div className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
          <div className="text-[10px] uppercase font-bold text-cyan-400">Real Sold</div>
          <div className="text-lg font-black text-cyan-400">{metrics.sold}</div>
          <div className="text-[10px] text-cyan-500/80">Auctioned in Mega</div>
        </div>
        <div className="p-2.5 rounded-xl border border-slate-500/30 bg-slate-500/5">
          <div className="text-[10px] uppercase font-bold text-slate-400">Real Unsold</div>
          <div className="text-lg font-black text-slate-400">{metrics.unsold}</div>
          <div className="text-[10px] text-slate-500/80">Unsold Lots</div>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Multi-Faceted Filters */}
      <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search players by name, country, role, franchise..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-secondary/40 border border-border/80 focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/80 text-foreground cursor-pointer text-xs"
          >
            <option value="ALL">All Roles</option>
            <option value="BATTER">Batters</option>
            <option value="ALL_ROUNDER">All-Rounders</option>
            <option value="WICKETKEEPER">Wicketkeepers</option>
            <option value="BOWLER">Bowlers</option>
          </select>

          {/* Capped / Uncapped Filter */}
          <select
            value={selectedCap}
            onChange={(e) => setSelectedCap(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/80 text-foreground cursor-pointer text-xs"
          >
            <option value="ALL">All Cap Status</option>
            <option value="CAPPED">Capped Only</option>
            <option value="UNCAPPED">Uncapped Only</option>
          </select>

          {/* Country Filter */}
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/80 text-foreground cursor-pointer text-xs"
          >
            <option value="ALL">All Nationalities</option>
            <option value="INDIA">India (Domestic)</option>
            <option value="OVERSEAS">Overseas (All)</option>
            <option value="Australia">Australia</option>
            <option value="England">England</option>
            <option value="South Africa">South Africa</option>
            <option value="New Zealand">New Zealand</option>
            <option value="West Indies">West Indies</option>
            <option value="Afghanistan">Afghanistan</option>
            <option value="Sri Lanka">Sri Lanka</option>
          </select>

          {/* Auction Set Filter */}
          <select
            value={selectedSet}
            onChange={(e) => setSelectedSet(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/80 text-foreground cursor-pointer text-xs max-w-[200px]"
          >
            <option value="ALL">All Auction Sets (1-13)</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.setCode} - {s.setName}
              </option>
            ))}
          </select>

          {/* Real IPL Outcome Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/80 text-foreground cursor-pointer text-xs"
          >
            <option value="ALL">All Real Outcomes</option>
            <option value="RETAINED">Official Retained</option>
            <option value="SOLD">Official Sold</option>
            <option value="UNSOLD">Official Unsold</option>
          </select>

          {/* Franchise Filter */}
          <select
            value={selectedFranchise}
            onChange={(e) => setSelectedFranchise(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/80 text-foreground cursor-pointer text-xs"
          >
            <option value="ALL">All Franchises</option>
            {FRANCHISES.map((f) => (
              <option key={f.code} value={f.code}>
                {f.code} ({f.name})
              </option>
            ))}
          </select>

          {/* Items Per Page */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/80 text-foreground cursor-pointer text-xs"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={0}>Show All ({totalItems})</option>
          </select>
        </div>

        {/* Filter Results Summary */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
          <div>
            Showing <strong className="text-foreground">{totalItems > 0 ? startIndex + 1 : 0} - {endIndex}</strong> of{" "}
            <strong className="text-foreground">{totalItems}</strong> filtered players
            {totalItems !== players.length && ` (out of ${players.length} total)`}
          </div>
          {totalPages > 1 && (
            <div>Page {currentPage} of {totalPages}</div>
          )}
        </div>
      </div>

      {/* Players Comprehensive Data Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase text-[10px] font-bold tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-3">Player & Styles</th>
                <th className="py-2.5 px-3">Role & Set</th>
                <th className="py-2.5 px-3">Nationality</th>
                <th className="py-2.5 px-3">Base Price</th>
                <th className="py-2.5 px-3">Career T20 Stats</th>
                <th className="py-2.5 px-3">Prev Franchise</th>
                <th className="py-2.5 px-3">Real IPL 2026</th>
                {showRatings && (
                  <th className="py-2.5 px-3 text-right text-amber-400 font-bold">
                    AI Rating (OVR)
                  </th>
                )}
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedPlayers.map((p) => {
                const setInfo = setsById.get(p.setId);
                const isSold = (p.officialStatus || "").toLowerCase() === "sold";
                const isRetained = (p.officialStatus || "").toLowerCase() === "retained";
                const isUnsold = (p.officialStatus || "").toLowerCase() === "unsold";

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-secondary/20 transition-colors group cursor-pointer"
                    onClick={() => setViewingPlayer(p)}
                  >
                    {/* 1. Player Info & Styles */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        <PlayerIdentity
                          name={p.name}
                          role={p.role}
                          country={p.country}
                          isOverseas={p.isOverseas}
                          size="sm"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-foreground text-xs hover:text-primary transition-colors">
                              {p.name}
                            </span>
                            <span
                              className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-tight ${
                                p.isCapped
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              {p.isCapped ? "Capped" : "Uncapped"}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-foreground/80">{p.battingStyle || "RHB"}</span>
                            {p.bowlingStyle && p.bowlingStyle !== "None" && p.bowlingStyle !== "-" && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[120px]">{p.bowlingStyle}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Role & Auction Set */}
                    <td className="py-2 px-3">
                      <div className="space-y-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.role === "BATTER"
                              ? "bg-blue-500/15 text-blue-300 border border-blue-500/25"
                              : p.role === "BOWLER"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                              : p.role === "ALL_ROUNDER"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                              : "bg-purple-500/15 text-purple-300 border border-purple-500/25"
                          }`}
                        >
                          {p.role.replace(/_/g, " ")}
                        </span>
                        <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1" title={setInfo?.setName || p.setId}>
                          <span className="font-bold text-foreground/80">{setInfo?.setCode || p.setId}</span>
                          {p.orderInSet && p.orderInSet !== 999 && (
                            <span className="text-[9px] text-muted-foreground bg-secondary px-1 rounded">
                              #{p.orderInSet}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 3. Country */}
                    <td className="py-2 px-3">
                      <div className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <CountryFlag country={p.country} size="xs" />
                        {p.isOverseas && (
                          <span title="Overseas Player">
                            <Plane className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. Base Price */}
                    <td className="py-2 px-3 font-mono font-bold text-emerald-400">
                      {formatRupees(p.basePrice)}
                    </td>

                    {/* 5. Complete Stats */}
                    <td className="py-2 px-3">
                      <div className="font-mono text-[10px] space-y-0.5 leading-tight">
                        <div className="text-foreground font-semibold flex items-center gap-1">
                          <span>{p.matches || 0}M</span>
                          <span>•</span>
                          <span className="text-emerald-400">{p.runs || 0}R</span>
                          <span>•</span>
                          <span className="text-cyan-400">{p.wickets || 0}W</span>
                        </div>
                        <div className="text-muted-foreground text-[9px] flex items-center gap-1">
                          <span>Avg: {p.battingAverage || 0}</span>
                          <span>•</span>
                          <span>SR: {p.strikeRate || 0}</span>
                          <span>•</span>
                          <span>Econ: {p.economy || 0}</span>
                        </div>
                      </div>
                    </td>

                    {/* 6. Previous Franchise */}
                    <td className="py-2 px-3">
                      {p.previousFranchise ? (
                        <div className="inline-flex items-center gap-1.5">
                          <TeamIdentity code={p.previousFranchise} size="sm" showLogo={true} />
                          <span className="text-[10px] font-bold font-mono">{p.previousFranchise}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* 7. Official IPL 2026 Outcome */}
                    <td className="py-2 px-3">
                      {isRetained ? (
                        <div className="space-y-0.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Retained ({p.officialTeamCode || "CSK"})
                          </span>
                          {p.officialPrice && p.officialPrice > 0 && (
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {formatRupees(p.officialPrice)}
                            </div>
                          )}
                        </div>
                      ) : isSold ? (
                        <div className="space-y-0.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Sold to {p.officialTeamCode || "Team"}
                          </span>
                          {p.officialPrice && p.officialPrice > 0 && (
                            <div className="text-[10px] font-mono text-emerald-400 font-bold">
                              {formatRupees(p.officialPrice)}
                            </div>
                          )}
                        </div>
                      ) : isUnsold ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-secondary text-muted-foreground border border-border">
                          Unsold
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono text-[10px]">—</span>
                      )}
                    </td>

                    {/* 8. AI Ratings */}
                    {showRatings && (
                      <td className="py-2 px-3 text-right">
                        <div className="space-y-0.5 inline-block text-right">
                          <span
                            className={`font-mono font-black text-xs px-2 py-0.5 rounded inline-block ${
                              (p.hiddenRatingOverall || 70) >= 88
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                : (p.hiddenRatingOverall || 70) >= 80
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : (p.hiddenRatingOverall || 70) >= 72
                                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                : "bg-secondary text-muted-foreground border border-border"
                            }`}
                          >
                            {p.hiddenRatingOverall || 70} OVR
                          </span>
                          <div className="text-[9px] font-mono text-muted-foreground">
                            BAT {p.hiddenRatingBatting || 70} • BOWL {p.hiddenRatingBowling || 70}
                          </div>
                        </div>
                      </td>
                    )}

                    {/* 9. Action Buttons */}
                    <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingPlayer(p)}
                          className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors"
                          title="View Full Player Dossier"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors"
                          title="Edit Player Details"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(p.id, p.name)}
                          className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 cursor-pointer transition-colors"
                          title="Delete Player"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedPlayers.length === 0 && (
                <tr>
                  <td colSpan={showRatings ? 9 : 8} className="py-12 text-center text-muted-foreground">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">No players found</div>
                      <div className="text-xs">Try clearing or loosening your search and filter criteria.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalItems > 0 && (
          <div className="p-3 bg-secondary/30 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground text-[11px]">
              Showing <span className="font-bold text-foreground">{startIndex + 1}</span> to{" "}
              <span className="font-bold text-foreground">{endIndex}</span> of{" "}
              <span className="font-bold text-foreground">{totalItems}</span> players
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-40 disabled:cursor-not-allowed border border-border/60 transition-colors"
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-40 disabled:cursor-not-allowed border border-border/60 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2.5 py-1 rounded-lg bg-card border border-border font-mono text-xs font-bold text-foreground">
                Page {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-40 disabled:cursor-not-allowed border border-border/60 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-40 disabled:cursor-not-allowed border border-border/60 transition-colors"
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FULL PLAYER DOSSIER MODAL */}
      {viewingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl p-6 text-foreground space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-3.5">
                <PlayerIdentity
                  name={viewingPlayer.name}
                  role={viewingPlayer.role}
                  country={viewingPlayer.country}
                  isOverseas={viewingPlayer.isOverseas}
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-foreground">{viewingPlayer.name}</h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${
                        viewingPlayer.isCapped
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {viewingPlayer.isCapped ? "Capped International" : "Uncapped Talent"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="font-semibold text-foreground">
                      {viewingPlayer.role.replace(/_/g, " ")}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <CountryFlag country={viewingPlayer.country} size="xs" />
                      {viewingPlayer.country}
                    </span>
                    {viewingPlayer.isOverseas && (
                      <span className="text-blue-400 text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
                        <Plane className="w-2.5 h-2.5" /> Overseas Quota
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewingPlayer(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer bg-secondary/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Profile Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-secondary/30 border border-border/80">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Base Price</div>
                <div className="text-base font-black font-mono text-emerald-400 mt-0.5">
                  {formatRupees(viewingPlayer.basePrice)}
                </div>
                <div className="text-[10px] text-muted-foreground">Auction Starting</div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border/80">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Auction Lot & Set</div>
                <div className="text-base font-black font-mono text-foreground mt-0.5">
                  {setsById.get(viewingPlayer.setId)?.setCode || viewingPlayer.setId}
                  {viewingPlayer.orderInSet && viewingPlayer.orderInSet !== 999 ? ` #${viewingPlayer.orderInSet}` : ""}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {setsById.get(viewingPlayer.setId)?.setName || "Official Lot"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border/80">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Prev Franchise</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {viewingPlayer.previousFranchise ? (
                    <>
                      <TeamIdentity code={viewingPlayer.previousFranchise} size="sm" showLogo={true} />
                      <span className="font-bold font-mono text-sm">{viewingPlayer.previousFranchise}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground font-mono text-xs">None / Fresh</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {viewingPlayer.previousFranchise ? "RTM Eligible" : "No RTM Card"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border/80">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Real IPL 2026</div>
                <div className="text-sm font-black font-mono mt-0.5 flex items-center gap-1">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                      viewingPlayer.officialStatus === "Sold"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : viewingPlayer.officialStatus === "Retained"
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {viewingPlayer.officialStatus || "Auction Pool"}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {viewingPlayer.officialTeam || "Not Contracted"}
                </div>
              </div>
            </div>

            {/* Cricket Career Statistics Section */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Career T20 Statistics (Cricsheet Ball-by-Ball)</span>
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Matches</div>
                  <div className="text-base font-black font-mono text-foreground">{viewingPlayer.matches || 0}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Runs</div>
                  <div className="text-base font-black font-mono text-emerald-400">{viewingPlayer.runs || 0}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Average</div>
                  <div className="text-base font-black font-mono text-foreground">{viewingPlayer.battingAverage || 0}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Strike Rate</div>
                  <div className="text-base font-black font-mono text-amber-400">{viewingPlayer.strikeRate || 0}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Wickets</div>
                  <div className="text-base font-black font-mono text-cyan-400">{viewingPlayer.wickets || 0}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Economy</div>
                  <div className="text-base font-black font-mono text-foreground">{viewingPlayer.economy || 0}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-secondary/20 border border-border/60">
                <div>
                  <span className="text-muted-foreground">Batting Style: </span>
                  <span className="font-bold text-foreground">{viewingPlayer.battingStyle || "Right-hand bat"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Bowling Style: </span>
                  <span className="font-bold text-foreground">{viewingPlayer.bowlingStyle || "None"}</span>
                </div>
              </div>
            </div>

            {/* AI Hidden Ratings Breakdown */}
            <div className="space-y-2.5 p-3.5 rounded-xl bg-secondary/20 border border-border/80">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Valuation & Hidden Rating Breakdown</span>
                </h3>
                <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {viewingPlayer.hiddenRatingOverall || 70} OVERALL
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-card/60 border border-border space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-blue-400">Batting Skill</span>
                    <span className="font-mono">{viewingPlayer.hiddenRatingBatting || 70} / 100</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, viewingPlayer.hiddenRatingBatting || 70)}%` }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-card/60 border border-border space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-emerald-400">Bowling Skill</span>
                    <span className="font-mono">{viewingPlayer.hiddenRatingBowling || 70} / 100</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, viewingPlayer.hiddenRatingBowling || 70)}%` }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-card/60 border border-border space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-purple-400">Keeping Skill</span>
                    <span className="font-mono">{viewingPlayer.hiddenRatingKeeping || 30} / 100</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, viewingPlayer.hiddenRatingKeeping || 30)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-border/60">
              <button
                onClick={() => {
                  const p = viewingPlayer;
                  setViewingPlayer(null);
                  handleOpenEdit(p);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 cursor-pointer flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Player Details</span>
              </button>

              <button
                onClick={() => setViewingPlayer(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PLAYER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-xl bg-card border border-border/80 rounded-2xl shadow-2xl p-6 text-foreground space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h2 className="text-base font-black">
                {editingPlayer ? `Edit Player: ${editingPlayer.name}` : "Add New Player"}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlayer} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Player Name</label>
                  <input
                    type="text"
                    required
                    value={playerForm.name}
                    onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Country</label>
                  <input
                    type="text"
                    required
                    value={playerForm.country}
                    onChange={(e) =>
                      setPlayerForm({
                        ...playerForm,
                        country: e.target.value,
                        isOverseas: e.target.value.toLowerCase() !== "india",
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Role</label>
                  <select
                    value={playerForm.role}
                    onChange={(e) => setPlayerForm({ ...playerForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer"
                  >
                    <option value="BATTER">Batter</option>
                    <option value="ALL_ROUNDER">All-Rounder</option>
                    <option value="WICKETKEEPER">Wicketkeeper</option>
                    <option value="BOWLER">Bowler</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Cap Status</label>
                  <select
                    value={playerForm.isCapped ? "capped" : "uncapped"}
                    onChange={(e) => setPlayerForm({ ...playerForm, isCapped: e.target.value === "capped" })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer"
                  >
                    <option value="capped">Capped (International)</option>
                    <option value="uncapped">Uncapped (Domestic)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Base Price</label>
                  <select
                    value={playerForm.basePrice}
                    onChange={(e) => setPlayerForm({ ...playerForm, basePrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer font-mono"
                  >
                    <option value={20000000}>₹2.00 Crore</option>
                    <option value={15000000}>₹1.50 Crore</option>
                    <option value={10000000}>₹1.00 Crore</option>
                    <option value={7500000}>₹75.00 Lakh</option>
                    <option value={5000000}>₹50.00 Lakh</option>
                    <option value={4000000}>₹40.00 Lakh</option>
                    <option value={3000000}>₹30.00 Lakh</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Batting Style</label>
                  <input
                    type="text"
                    value={playerForm.battingStyle}
                    onChange={(e) => setPlayerForm({ ...playerForm, battingStyle: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                    placeholder="e.g. Right-hand bat, Left-hand bat"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Bowling Style</label>
                  <input
                    type="text"
                    value={playerForm.bowlingStyle}
                    onChange={(e) => setPlayerForm({ ...playerForm, bowlingStyle: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                    placeholder="e.g. Right-arm fast, Legbreak, None"
                  />
                </div>
              </div>

              {/* Career Stats Grid */}
              <div className="space-y-1 pt-1">
                <label className="font-bold text-foreground block">Career T20 Statistics</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Matches</span>
                    <input
                      type="number"
                      value={playerForm.matches}
                      onChange={(e) => setPlayerForm({ ...playerForm, matches: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Runs</span>
                    <input
                      type="number"
                      value={playerForm.runs}
                      onChange={(e) => setPlayerForm({ ...playerForm, runs: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Batting Avg</span>
                    <input
                      type="number"
                      step="0.01"
                      value={playerForm.battingAverage}
                      onChange={(e) => setPlayerForm({ ...playerForm, battingAverage: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Strike Rate</span>
                    <input
                      type="number"
                      step="0.1"
                      value={playerForm.strikeRate}
                      onChange={(e) => setPlayerForm({ ...playerForm, strikeRate: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Wickets</span>
                    <input
                      type="number"
                      value={playerForm.wickets}
                      onChange={(e) => setPlayerForm({ ...playerForm, wickets: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Economy</span>
                    <input
                      type="number"
                      step="0.01"
                      value={playerForm.economy}
                      onChange={(e) => setPlayerForm({ ...playerForm, economy: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Auction Set & Prev Franchise */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-foreground block mb-1">Auction Set</label>
                  <select
                    value={playerForm.setId}
                    onChange={(e) => setPlayerForm({ ...playerForm, setId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer"
                  >
                    {sets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.setCode} - {s.setName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Lot Order</label>
                  <input
                    type="number"
                    value={playerForm.orderInSet}
                    onChange={(e) => setPlayerForm({ ...playerForm, orderInSet: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Previous Franchise (RTM)</label>
                  <select
                    value={playerForm.previousFranchise || ""}
                    onChange={(e) => setPlayerForm({ ...playerForm, previousFranchise: e.target.value || null })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer"
                  >
                    <option value="">None / Fresh Auction Entry</option>
                    {FRANCHISES.map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.code} ({f.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Overall AI Rating (45-99)
                  </label>
                  <input
                    type="number"
                    min={45}
                    max={99}
                    value={playerForm.hiddenRatingOverall}
                    onChange={(e) => setPlayerForm({ ...playerForm, hiddenRatingOverall: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono font-bold text-amber-400"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  {editingPlayer ? "Save Changes" : "Create Player"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT DATASET MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl p-6 text-foreground space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h2 className="text-base font-black">Import Player Dataset</h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 p-1 rounded-xl bg-secondary/40 border border-border/80 text-xs">
              <button
                type="button"
                onClick={() => setImportSourceType("CSV")}
                className={`flex-1 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
                  importSourceType === "CSV" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground"
                }`}
              >
                CSV Ingestion
              </button>
              <button
                type="button"
                onClick={() => setImportSourceType("URL")}
                className={`flex-1 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
                  importSourceType === "URL" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground"
                }`}
              >
                Cricinfo URL
              </button>
            </div>

            {importSourceType === "CSV" ? (
              <div className="space-y-2 text-xs">
                <label className="font-bold text-foreground block">Paste CSV Records</label>
                <textarea
                  rows={8}
                  placeholder={`Player,Country,Role,Base Price (₹),Capped/Uncapped\nCameron Green,Australia,All-rounder,20000000,Capped\nSarfaraz Khan,India,Batter,7500000,Capped`}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full p-3 rounded-lg bg-secondary/40 border border-border/80 font-mono text-[11px] text-foreground focus:outline-hidden"
                />
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <label className="font-bold text-foreground block">Cricinfo Shortlist URL</label>
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border/80 text-foreground"
                />
              </div>
            )}

            {importResult && (
              <div className="p-3 rounded-lg bg-secondary/30 border border-border text-xs space-y-1">
                <div className="font-bold text-emerald-400">
                  Import Succeeded: {importResult.totalImported} players ingested
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Job ID: {importResult.jobId} • Errors: {importResult.errors?.length || 0}
                </div>
              </div>
            )}

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleRunImport}
                disabled={isImporting || (importSourceType === "CSV" && !csvContent.trim())}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Execute Ingestion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
