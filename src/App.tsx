/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Star, 
  RefreshCw, 
  Trophy, 
  Activity, 
  MapPin, 
  PieChart as PieChartIcon,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Globe,
  Facebook,
  Video
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  limit,
  where
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { Branch, Metric, Platform, Sentiment, SWOTAnalysis, TOWSMatrix } from './types';
import { generateStrategicAnalysis } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Mock Data Generator ---
const generateMockMetrics = (branchId: string, platform: Platform): Metric => {
  const baseLikes = Math.floor(Math.random() * 500) + 100;
  const baseViews = Math.floor(Math.random() * 5000) + 1000;
  const baseComments = Math.floor(Math.random() * 50) + 5;
  const baseRating = platform === 'google' ? (Math.random() * 1.5 + 3.5).toFixed(1) : undefined;
  
  return {
    branchId,
    platform,
    date: new Date(),
    likes: baseLikes,
    views: baseViews,
    comments: baseComments,
    rating: baseRating ? parseFloat(baseRating) : undefined,
    sentiment: Math.random() > 0.7 ? 'positive' : Math.random() > 0.3 ? 'neutral' : 'negative',
    engagementRate: parseFloat(((baseLikes + baseComments) / baseViews * 100).toFixed(2))
  };
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{ swot: SWOTAnalysis; tows: TOWSMatrix } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return;

    const branchesUnsubscribe = onSnapshot(collection(db, 'branches'), (snapshot) => {
      const branchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
      setBranches(branchesData);
    });

    const metricsUnsubscribe = onSnapshot(query(collection(db, 'metrics'), orderBy('date', 'desc'), limit(500)), (snapshot) => {
      const metricsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date?.toDate() } as Metric));
      setMetrics(metricsData);
    });

    return () => {
      branchesUnsubscribe();
      metricsUnsubscribe();
    };
  }, [user]);

  // --- Sync Simulation ---
  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      // If no branches, create some initial ones
      if (branches.length === 0) {
        const initialBranches = [
          { name: "Autobacs Rama 9", location: "Bangkok", socialLinks: { google: "link", tiktok: "link", facebook: "link" } },
          { name: "Autobacs Sukhumvit", location: "Bangkok", socialLinks: { google: "link", tiktok: "link", facebook: "link" } },
          { name: "Autobacs Chiang Mai", location: "Chiang Mai", socialLinks: { google: "link", tiktok: "link", facebook: "link" } },
          { name: "Autobacs Phuket", location: "Phuket", socialLinks: { google: "link", tiktok: "link", facebook: "link" } },
          { name: "Autobacs Khon Kaen", location: "Khon Kaen", socialLinks: { google: "link", tiktok: "link", facebook: "link" } },
        ];

        for (const b of initialBranches) {
          const docRef = await addDoc(collection(db, 'branches'), { ...b, id: '' });
          await updateDoc(docRef, { id: docRef.id });
        }
      }

      // Generate new metrics for each branch
      const currentBranches = branches.length > 0 ? branches : []; // Will be updated on next snapshot
      const snapshot = await getDocs(collection(db, 'branches'));
      const allBranches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));

      for (const branch of allBranches) {
        const platforms: Platform[] = ['google', 'tiktok', 'facebook'];
        for (const platform of platforms) {
          const metric = generateMockMetrics(branch.id, platform);
          await addDoc(collection(db, 'metrics'), {
            ...metric,
            date: serverTimestamp()
          });
        }
        await updateDoc(doc(db, 'branches', branch.id), { lastSync: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  // --- AI Analysis ---
  const handleAnalyze = async () => {
    if (metrics.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = await generateStrategicAnalysis(metrics.slice(0, 20));
      setAnalysis(result);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Computed Stats ---
  const totalStats = useMemo(() => {
    return metrics.reduce((acc, m) => ({
      likes: acc.likes + m.likes,
      views: acc.views + m.views,
      comments: acc.comments + m.comments,
    }), { likes: 0, views: 0, comments: 0 });
  }, [metrics]);

  const leaderboard = useMemo(() => {
    const branchStats = branches.map(b => {
      const branchMetrics = metrics.filter(m => m.branchId === b.id);
      const totalEngagement = branchMetrics.reduce((acc, m) => acc + m.likes + m.comments, 0);
      return { ...b, totalEngagement };
    });
    return branchStats.sort((a, b) => b.totalEngagement - a.totalEngagement).slice(0, 10);
  }, [branches, metrics]);

  const platformDistribution = useMemo(() => {
    const dist = { google: 0, tiktok: 0, facebook: 0 };
    metrics.forEach(m => dist[m.platform]++);
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [metrics]);

  const COLORS = ['#FFD700', '#FF0050', '#1877F2']; // Autobacs Gold, TikTok Red, Facebook Blue

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-medium animate-pulse">Initializing Autobacs Social Pulse...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#141414] border border-white/5 rounded-3xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Activity className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Autobacs Social Pulse</h1>
          <p className="text-gray-400 mb-8">Centralized Social Media Performance Tracking & AI-Driven Strategic Analysis.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-3 group"
          >
            <Globe className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-72 bg-[#111111] border-r border-white/5 z-50 hidden lg:flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Autobacs Pulse</span>
          </div>

          <nav className="space-y-2">
            <NavItem icon={<LayoutDashboard />} label="Dashboard" active />
            <NavItem icon={<TrendingUp />} label="Performance" />
            <NavItem icon={<Users />} label="Branches" />
            <NavItem icon={<MessageSquare />} label="Sentiments" />
            <NavItem icon={<Star />} label="Reviews" />
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border border-white/10" alt="Avatar" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="w-full py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 p-6 lg:p-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-bold mb-1">Social Media Pulse</h2>
            <p className="text-gray-500">Monitoring {branches.length} branches across Thailand.</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleSync}
              disabled={syncing}
              className={cn(
                "px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold flex items-center gap-2 transition-all",
                syncing && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-5 h-5", syncing && "animate-spin")} />
              {syncing ? "Syncing Data..." : "Sync Now"}
            </button>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing || metrics.length === 0}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20"
            >
              <Activity className={cn("w-5 h-5", isAnalyzing && "animate-pulse")} />
              {isAnalyzing ? "Analyzing..." : "AI Strategy"}
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard 
            label="Total Views" 
            value={totalStats.views.toLocaleString()} 
            icon={<TrendingUp className="text-blue-500" />}
            trend="+12.5%"
            color="blue"
          />
          <StatCard 
            label="Total Engagement" 
            value={(totalStats.likes + totalStats.comments).toLocaleString()} 
            icon={<Users className="text-orange-500" />}
            trend="+8.2%"
            color="orange"
          />
          <StatCard 
            label="Avg. Rating" 
            value="4.7" 
            icon={<Star className="text-yellow-500" />}
            trend="+0.2"
            color="yellow"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
          <div className="xl:col-span-2 bg-[#111111] border border-white/5 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold">Engagement Trends</h3>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>Likes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Comments</span>
                </div>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.slice(0, 15).reverse()}>
                  <defs>
                    <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#ffffff20" 
                    fontSize={12} 
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#ffffff20" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="likes" stroke="#f97316" fillOpacity={1} fill="url(#colorLikes)" strokeWidth={3} />
                  <Area type="monotone" dataKey="comments" stroke="#3b82f6" fillOpacity={0} strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#111111] border border-white/5 rounded-3xl p-8">
            <h3 className="text-xl font-bold mb-8">Platform Distribution</h3>
            <div className="h-[300px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {platformDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold">{metrics.length}</span>
                <span className="text-xs text-gray-500 uppercase tracking-widest">Total Posts</span>
              </div>
            </div>
            <div className="space-y-4 mt-6">
              {platformDistribution.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="capitalize text-sm text-gray-400">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Analysis Section */}
        <AnimatePresence>
          {analysis && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-10 overflow-hidden"
            >
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">AI Strategic Analysis</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* SWOT */}
                  <div>
                    <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <LayoutDashboard className="w-5 h-5 text-orange-500" />
                      SWOT Analysis
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <AnalysisBox title="Strengths" items={analysis.swot.strengths} color="green" />
                      <AnalysisBox title="Weaknesses" items={analysis.swot.weaknesses} color="red" />
                      <AnalysisBox title="Opportunities" items={analysis.swot.opportunities} color="blue" />
                      <AnalysisBox title="Threats" items={analysis.swot.threats} color="yellow" />
                    </div>
                  </div>

                  {/* TOWS */}
                  <div>
                    <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <TrendingUp className="text-orange-500" />
                      TOWS Matrix Strategy
                    </h4>
                    <div className="space-y-4">
                      <TOWSBox title="SO (Aggressive)" items={analysis.tows.so} />
                      <TOWSBox title="WO (Improvement)" items={analysis.tows.wo} />
                      <TOWSBox title="ST (Defensive)" items={analysis.tows.st} />
                      <TOWSBox title="WT (Survival)" items={analysis.tows.wt} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <Trophy className="text-yellow-500" />
                Top Performing Branches
              </h3>
              <button className="text-sm text-orange-500 font-bold hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              {leaderboard.map((branch, index) => (
                <motion.div 
                  key={branch.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                      index === 0 ? "bg-yellow-500/20 text-yellow-500" : 
                      index === 1 ? "bg-gray-400/20 text-gray-400" :
                      index === 2 ? "bg-orange-500/20 text-orange-500" : "bg-white/5 text-gray-500"
                    )}>
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-bold group-hover:text-orange-500 transition-colors">{branch.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {branch.location}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{branch.totalEngagement.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Engagement</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#111111] border border-white/5 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <Activity className="text-blue-500" />
                Live Pulse Feed
              </h3>
              <div className="flex gap-2">
                <PlatformFilter icon={<Globe />} active />
                <PlatformFilter icon={<Video />} />
                <PlatformFilter icon={<Facebook />} />
              </div>
            </div>
            <div className="space-y-6">
              {metrics.slice(0, 8).map((metric, index) => {
                const branch = branches.find(b => b.id === metric.branchId);
                return (
                  <div key={index} className="flex gap-4 relative">
                    {index !== 7 && <div className="absolute left-5 top-10 bottom-0 w-px bg-white/5" />}
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10",
                      metric.platform === 'google' ? "bg-yellow-500/10 text-yellow-500" :
                      metric.platform === 'tiktok' ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {metric.platform === 'google' ? <Globe className="w-5 h-5" /> : 
                       metric.platform === 'tiktok' ? <Video className="w-5 h-5" /> : <Facebook className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold">
                          {branch?.name || "Unknown Branch"}
                        </p>
                        <span className="text-[10px] text-gray-500">
                          {metric.date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        New {metric.platform} content reached <span className="text-white font-medium">{metric.views.toLocaleString()}</span> views with <span className="text-white font-medium">{metric.likes}</span> likes.
                      </p>
                      <div className="flex items-center gap-3">
                        <SentimentBadge sentiment={metric.sentiment || 'neutral'} />
                        <span className="text-[10px] text-gray-600">ER: {metric.engagementRate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Subcomponents ---

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={cn(
      "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group",
      active ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-gray-500 hover:text-white hover:bg-white/5"
    )}>
      <span className={cn("w-5 h-5 transition-transform group-hover:scale-110", active ? "text-white" : "text-gray-500")}>
        {icon}
      </span>
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon, trend, color }: { label: string, value: string, icon: React.ReactNode, trend: string, color: string }) {
  return (
    <div className="bg-[#111111] border border-white/5 rounded-3xl p-8 hover:border-white/10 transition-all group">
      <div className="flex items-center justify-between mb-6">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6",
          color === 'blue' ? "bg-blue-500/10" : color === 'orange' ? "bg-orange-500/10" : "bg-yellow-500/10"
        )}>
          {icon}
        </div>
        <div className={cn(
          "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1",
          trend.startsWith('+') ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
        )}>
          {trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <p className="text-gray-500 text-sm font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function AnalysisBox({ title, items, color }: { title: string, items: string[], color: 'green' | 'red' | 'blue' | 'yellow' }) {
  const colors = {
    green: "border-green-500/20 bg-green-500/5 text-green-500",
    red: "border-red-500/20 bg-red-500/5 text-red-500",
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-500",
    yellow: "border-yellow-500/20 bg-yellow-500/5 text-yellow-500"
  };

  return (
    <div className={cn("p-4 rounded-2xl border", colors[color])}>
      <p className="text-xs font-bold uppercase tracking-widest mb-3 opacity-80">{title}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-white/80 leading-relaxed flex gap-2">
            <span className="opacity-40">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TOWSBox({ title, items }: { title: string, items: string[] }) {
  return (
    <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
      <p className="text-sm font-bold text-orange-500 mb-3">{title}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
            <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-orange-500/50" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const styles = {
    positive: "bg-green-500/10 text-green-500",
    neutral: "bg-gray-500/10 text-gray-500",
    negative: "bg-red-500/10 text-red-500"
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider", styles[sentiment])}>
      {sentiment}
    </span>
  );
}

function PlatformFilter({ icon, active = false }: { icon: React.ReactNode, active?: boolean }) {
  return (
    <button className={cn(
      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
      active ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-400"
    )}>
      {icon}
    </button>
  );
}

