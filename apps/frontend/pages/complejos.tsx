import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Star, ChevronDown, X, SlidersHorizontal, Flame, Tag } from 'lucide-react';
import DarkPageLayout from '../components/DarkPageLayout';
import UserLoadingState from '../components/UserLoadingState';
import { ClubService, Club } from '../services/ClubService';
import { getClubReviewsSummary } from '../services/ClubReviewService';
import { useUserTheme } from '../contexts/UserThemeContext';

/* ── Geocoding (Nominatim, sin API key) ──────────────────────────── */
const geocode = async (address: string): Promise<{ lat: number; lon: number } | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
  } catch { return null; }
};

/* ── CSS ─────────────────────────────────────────────────────────── */
const PAGE_CSS = `
  /* Hero */
  .p-breadcrumbs-wrap { position:relative; z-index:45; background:transparent; }
  .vn-hero { position:relative; overflow:visible; border-bottom:1px solid var(--border-subtle); z-index:30; isolation:isolate; }
  .vn-hero-bg { position:absolute; top:-76px; right:0; bottom:0; left:0; z-index:0; pointer-events:none; overflow:hidden;
    background:linear-gradient(180deg, rgba(182,243,106,.07) 0%, transparent 76%); }
  .vn-hero-bg::before,
  .vn-hero-bg::after { content:""; position:absolute; inset:-26%; will-change:transform; }
  .vn-hero-bg::before {
    background:radial-gradient(ellipse 70% 58% at 62% 78%, var(--positive-bg) 0%, transparent 68%),
               radial-gradient(ellipse 48% 38% at 12% 20%, var(--accent-bg-faint) 0%, transparent 62%);
    opacity:.88;
    animation:vn-gradient-drift-a 13s ease-in-out infinite alternate;
  }
  .vn-hero-bg::after {
    background:radial-gradient(ellipse 42% 34% at 82% 18%, rgba(182,243,106,.14) 0%, transparent 64%),
               radial-gradient(ellipse 36% 28% at 22% 88%, rgba(255,255,255,.08) 0%, transparent 66%);
    opacity:.56;
    animation:vn-gradient-drift-b 18s ease-in-out infinite alternate;
  }
  @keyframes vn-gradient-drift-a {
    from { transform:translate3d(-3.2%, -2.2%, 0) scale(1); }
    to { transform:translate3d(3.6%, 2.8%, 0) scale(1.08); }
  }
  @keyframes vn-gradient-drift-b {
    from { transform:translate3d(2.8%, -1.8%, 0) scale(1.03); }
    to { transform:translate3d(-3.4%, 3%, 0) scale(1.1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .vn-hero-bg::before,
    .vn-hero-bg::after { animation:none; }
  }
  .vn-hero-inner { position:relative; z-index:2; max-width:860px; margin:0 auto; padding:72px 40px 60px; text-align:center; }
  .vn-badge { display:inline-flex; align-items:center; gap:8px; padding:5px 14px; border-radius:999px;
    background:var(--positive-bg); border:1px solid var(--accent-border-subtle);
    font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--accent-fg); margin-bottom:20px; }
  .vn-badge-dot { width:6px; height:6px; border-radius:50%; background:var(--brand); animation:p-public-pulse 2s ease-in-out infinite; }
  .vn-eyebrow { font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--text-muted); margin-bottom:14px; }
  .vn-h1 { font-size:clamp(36px,5vw,64px); font-weight:800; letter-spacing:-.04em; line-height:1.05; color:var(--text-primary); margin:0 0 16px; }
  .vn-h1 i { font-style:italic; color:var(--accent-fg); }
  .vn-sub { font-size:16px; color:var(--text-muted); font-weight:400; margin:0 0 36px; line-height:1.6; }
  /* Search */
  .vn-search { display:flex; align-items:center; background:var(--surface-1); border:1px solid var(--border);
    border-radius:999px; overflow:hidden; box-shadow:var(--shadow-md);
    max-width:640px; margin:0 auto 24px; transition:border-color .2s; }
  .vn-search:focus-within { border-color:var(--accent-border); }
  .vn-search-ico { padding:0 14px 0 20px; color:var(--text-muted); display:flex; align-items:center; flex-shrink:0; }
  .vn-search-input { flex:1; background:transparent; border:none; outline:none; color:var(--text-primary);
    font-family:var(--font-sans); font-size:14px; font-weight:500; padding:14px 0; }
  .vn-search-input::placeholder { color:var(--text-muted); font-weight:400; }
  .vn-search-clear { background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0 8px; display:flex; align-items:center; }
  /* Chips */
  .vn-filters { display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center; }
  .vn-chip-wrap { position:relative; }
  .vn-chip { position:relative; display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:999px;
    background:var(--surface-2); border:1px solid var(--border);
    font-size:12px; font-weight:700; color:var(--text-muted); cursor:pointer; font-family:inherit;
    transition:border-color .15s,color .15s, background .15s; appearance:none; }
  .vn-chip:hover { border-color:var(--border-strong); color:var(--text-primary); }
  .vn-chip.vn-active { background:var(--positive-bg); border-color:var(--accent-border); color:var(--accent-fg); }
  .vn-chip-ico { width:13px; height:13px; flex-shrink:0; }
  .vn-chip-caret { width:11px; height:11px; flex-shrink:0; color:var(--text-muted); transform-origin:center; transition:transform .22s ease, color .18s ease; }
  .vn-chip-wrap:hover .vn-chip-caret { color:var(--text-muted); }
  .vn-chip-wrap.vn-open .vn-chip-caret { transform:rotate(180deg); color:var(--accent-fg); }
  .vn-dropdown { position:absolute; top:calc(100% + 8px); left:0; min-width:260px; background:var(--surface-1); border:1px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:var(--shadow-lg); z-index:120; }
  .vn-dropdown-head { padding:10px 16px; border-bottom:1px solid var(--border); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.14em; color:var(--text-muted); }
  .vn-dropdown-list { max-height:220px; overflow-y:auto; margin:0; padding:0; list-style:none; }
  .vn-dropdown-item { width:100%; display:flex; align-items:center; gap:10px; padding:11px 16px; background:transparent; border:0; border-bottom:1px solid var(--border-subtle); cursor:pointer; font-family:inherit; font-size:13px; color:var(--text-secondary); font-weight:500; text-align:left; transition:background .15s, color .15s; }
  .vn-dropdown-item:last-child { border-bottom:none; }
  .vn-dropdown-item:hover { background:var(--surface-2); }
  .vn-dropdown-item.vn-selected { background:var(--positive-bg); color:var(--accent-fg); }
  .vn-dropdown-item-ico { width:13px; height:13px; color:var(--accent-fg); flex-shrink:0; }
  .vn-chip-sep { width:1px; height:20px; background:var(--surface-2); margin:0 2px; }
  .vn-adv-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:999px;
    background:var(--surface-2); border:1px solid var(--border);
    font-size:12px; font-weight:700; color:var(--text-muted); cursor:pointer; font-family:inherit; transition:border-color .15s,color .15s; }
  .vn-adv-btn:hover { border-color:var(--border-strong); color:var(--text-primary); }
  /* Adv panel */
  .vn-adv { max-width:640px; margin:16px auto 0; background:var(--surface-1); border:1px solid var(--border);
    border-radius:16px; padding:18px 22px; display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; }
  .vn-adv label { display:block; font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px; }
  .vn-adv input[type="number"] { width:140px; padding:9px 12px; background:var(--surface-2);
    border:1px solid var(--border); border-radius:10px;
    color:var(--text-primary); font-family:inherit; font-size:13px; font-weight:600; outline:none; }
  .vn-adv input[type="number"]:focus { border-color:var(--accent-border); }
  .vn-adv-apply { padding:10px 20px; border-radius:10px; background:var(--brand); border:none; color:var(--brand-on);
    font-size:12px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; font-family:inherit; }
  /* Featured */
  .vn-feat { position:relative; z-index:10; border-bottom:1px solid var(--border-subtle); }
  .vn-feat-inner { max-width:1360px; margin:0 auto; padding:64px 40px; }
  .vn-feat-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:32px; flex-wrap:wrap; }
  .vn-feat-title { font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:-.025em; margin:0 0 4px; }
  .vn-feat-sub { font-size:13px; color:var(--text-muted); margin:0; }
  .vn-feat-tabs { display:flex; gap:6px; flex-wrap:wrap; }
  .vn-feat-tab { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:999px;
    background:var(--surface-2); border:1px solid var(--border);
    font-size:12px; font-weight:700; color:var(--text-muted); cursor:pointer; font-family:inherit; transition:all .15s; }
  .vn-feat-tab:hover { color:var(--text-primary); border-color:var(--border); }
  .vn-feat-tab.vn-feat-tab-active { background:var(--positive-bg); border-color:var(--accent-border); color:var(--accent-fg); }
  .vn-feat-tab svg { width:13px; height:13px; }
  /* Featured cards track */
  .vn-feat-track { display:flex; gap:16px; overflow-x:auto; padding-top:6px; padding-bottom:4px; scroll-snap-type:x mandatory; -ms-overflow-style:none; scrollbar-width:none; }
  .vn-feat-track::-webkit-scrollbar { display:none; }
  .vn-feat-card { flex:0 0 300px; scroll-snap-align:start; background:var(--surface-1); border:1px solid var(--border);
    border-radius:18px; overflow:hidden; text-decoration:none; color:inherit; position:relative; z-index:0;
    transition:border-color .2s,transform .2s,box-shadow .2s; display:flex; flex-direction:column; }
  .vn-feat-card:hover { border-color:var(--accent-border-subtle); transform:translateY(-3px); box-shadow:var(--shadow-lg); z-index:2; }
  .vn-feat-card-img { position:relative; height:160px; background:var(--surface-3); flex-shrink:0; overflow:hidden; }
  .vn-feat-card-body { padding:14px 16px 16px; display:flex; flex-direction:column; gap:6px; flex:1; }
  .vn-feat-card-name { font-size:14px; font-weight:800; color:var(--text-primary); }
  .vn-feat-card-addr { font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:4px; }
  .vn-feat-card-rating { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:700; color:var(--accent-fg); }
  .vn-feat-empty { padding:40px 20px; text-align:center; color:var(--text-muted); font-size:13px; font-weight:600; }
  /* Map */
  .vn-map-sec { border-top:1px solid var(--border-subtle); }
  .vn-map-inner { max-width:1360px; margin:0 auto; padding:64px 40px; }
  .vn-map-head { margin-bottom:24px; }
  .vn-map-title { font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:-.025em; margin:0 0 4px; }
  .vn-map-sub { font-size:13px; color:var(--text-muted); margin:0; }
  .vn-map-wrap { height:420px; border-radius:20px; overflow:hidden; border:1px solid var(--border);
    background:var(--surface-1); position:relative; }
  .vn-map-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    flex-direction:column; gap:12px; color:var(--text-muted); font-size:13px; font-weight:600; }
  /* Body / grid */
  .vn-body { max-width:1360px; margin:0 auto; padding:48px 40px 80px; }
  .vn-results-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; gap:12px; flex-wrap:wrap; }
  .vn-results-copy { min-width:240px; }
  .vn-results-section-title { font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:-.025em; margin:0 0 4px; }
  .vn-results-section-sub { font-size:13px; color:var(--text-muted); margin:0; }
  .vn-results-title { font-size:13px; font-weight:700; color:var(--text-muted); letter-spacing:.04em; }
  .vn-results-title b { color:var(--text-primary); }
  .vn-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:20px; }
  /* Club card */
  .vn-card { background:var(--surface-1); border:1px solid var(--border); border-radius:20px; overflow:hidden;
    transition:border-color .2s,transform .2s,box-shadow .2s; text-decoration:none; color:inherit; position:relative; z-index:0;
    display:flex; flex-direction:column; }
  .vn-card:hover { border-color:var(--accent-border-subtle); transform:translateY(-3px); box-shadow:var(--shadow-lg); z-index:2; }
  .vn-card-img { position:relative; height:200px; background:var(--surface-3); overflow:hidden; flex-shrink:0; }
  .vn-card-img-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg,var(--surface-1) 0%,var(--surface-3) 50%,var(--surface-1) 100%); }
  .vn-card-logo { position:absolute; bottom:12px; left:12px; width:44px; height:44px; border-radius:10px;
    background:var(--surface-1); border:2px solid var(--border); overflow:hidden; display:flex; align-items:center; justify-content:center; }
  .vn-card-rating { position:absolute; top:12px; right:12px; display:inline-flex; align-items:center; gap:5px;
    padding:4px 10px; border-radius:999px; background:var(--overlay); backdrop-filter:blur(8px);
    border:1px solid var(--border); font-size:11px; font-weight:700; color:var(--text-primary); }
  .vn-card-rating svg { color:var(--accent-fg); }
  .vn-card-body { padding:18px 20px 20px; flex:1; display:flex; flex-direction:column; gap:8px; }
  .vn-card-name { font-size:16px; font-weight:800; color:var(--text-primary); letter-spacing:-.01em; }
  .vn-card-addr { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted); font-weight:500; }
  .vn-card-addr svg { color:var(--text-muted); flex-shrink:0; }
  .vn-card-desc { font-size:13px; color:var(--text-muted); line-height:1.5;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .vn-card-footer { margin-top:auto; padding-top:14px; border-top:1px solid var(--border-subtle);
    display:flex; align-items:center; justify-content:flex-end; }
  .vn-card-cta { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:999px;
    background:var(--brand); color:var(--brand-on); font-size:11px; font-weight:800; letter-spacing:.06em;
    text-transform:uppercase; white-space:nowrap; flex-shrink:0; transition:background .15s; }
  .vn-card:hover .vn-card-cta { background:var(--accent-fg); }
  /* Empty / skeleton */
  .vn-empty { grid-column:1/-1; padding:80px 0; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; }
  .vn-empty-ico { color:var(--accent-border-subtle); }
  .vn-empty-title { font-size:18px; font-weight:800; color:var(--text-primary); }
  .vn-empty-sub { font-size:14px; color:var(--text-muted); }
  .vn-skeleton { animation:p-public-pulse 1.5s ease-in-out infinite; }
  .vn-skel-card { background:var(--surface-1); border:1px solid var(--border-subtle); border-radius:20px; overflow:hidden; }
  .vn-skel-img { height:200px; background:var(--surface-2); }
  .vn-skel-body { padding:18px 20px 20px; display:flex; flex-direction:column; gap:10px; }
  .vn-skel-line { height:12px; border-radius:6px; background:var(--surface-2); }
  /* Responsive */
  @media(max-width:720px){
    .vn-hero-inner,.vn-feat-inner,.vn-map-inner,.vn-body { padding-left:20px; padding-right:20px; }
    .vn-hero-inner { padding-top:56px; padding-bottom:48px; }
    .vn-grid { grid-template-columns:1fr; }
    .vn-h1 { font-size:36px; }
    .vn-feat-inner,.vn-map-inner { padding-top:48px; padding-bottom:48px; }
    .vn-feat-head { flex-direction:column; }
  }
  .p-public-root.p-public-theme-light .vn-hero { border-bottom-color:rgba(106,176,48,.18); }
  .p-public-root.p-public-theme-light .vn-hero-bg {
    background:linear-gradient(180deg, #fbfff4 0%, rgba(245,244,240,.88) 72%, var(--bg) 100%);
  }
  .p-public-root.p-public-theme-light .vn-hero-bg::before {
    background:radial-gradient(ellipse 72% 58% at 62% 74%, rgba(182,243,106,.52) 0%, rgba(182,243,106,.23) 34%, transparent 70%),
               radial-gradient(ellipse 48% 38% at 11% 22%, rgba(47,175,106,.22) 0%, rgba(47,175,106,.11) 35%, transparent 64%);
    opacity:1;
    filter:saturate(1.12);
  }
  .p-public-root.p-public-theme-light .vn-hero-bg::after {
    background:radial-gradient(ellipse 42% 32% at 84% 18%, rgba(255,209,102,.20) 0%, transparent 64%);
    opacity:.56;
    mix-blend-mode:multiply;
  }
  .p-public-root.p-public-theme-light .vn-badge { background:var(--positive-bg); border-color:var(--accent-border); color:var(--accent-fg); }
  .p-public-root.p-public-theme-light .vn-eyebrow { color:var(--text-muted); }
  .p-public-root.p-public-theme-light .vn-h1,
  .p-public-root.p-public-theme-light .vn-feat-title,
  .p-public-root.p-public-theme-light .vn-map-title,
  .p-public-root.p-public-theme-light .vn-results-section-title,
  .p-public-root.p-public-theme-light .vn-card-name,
  .p-public-root.p-public-theme-light .vn-feat-card-name,
  .p-public-root.p-public-theme-light .vn-empty-title { color:var(--text-primary); }
  .p-public-root.p-public-theme-light .vn-sub,
  .p-public-root.p-public-theme-light .vn-card-desc,
  .p-public-root.p-public-theme-light .vn-empty-sub,
  .p-public-root.p-public-theme-light .vn-results-section-sub,
  .p-public-root.p-public-theme-light .vn-feat-sub,
  .p-public-root.p-public-theme-light .vn-map-sub { color:var(--text-secondary); }
  .p-public-root.p-public-theme-light .vn-search { background:var(--surface-1); border-color:var(--border); box-shadow:0 12px 30px var(--border); }
  .p-public-root.p-public-theme-light .vn-search:focus-within { border-color:var(--accent-border-strong); }
  .p-public-root.p-public-theme-light .vn-search-ico { color:var(--text-muted); }
  .p-public-root.p-public-theme-light .vn-search-input { color:var(--text-primary); }
  .p-public-root.p-public-theme-light .vn-search-input::placeholder { color:var(--text-muted); }
  .p-public-root.p-public-theme-light .vn-search-clear { color:var(--text-muted); }
  .p-public-root.p-public-theme-light .vn-chip,
  .p-public-root.p-public-theme-light .vn-adv-btn { background:var(--surface-1); border-color:var(--border); color:var(--text-secondary); box-shadow:0 4px 12px var(--surface-2); }
  .p-public-root.p-public-theme-light .vn-chip:hover,
  .p-public-root.p-public-theme-light .vn-adv-btn:hover { border-color:var(--border-strong); color:var(--text-primary); }
  .p-public-root.p-public-theme-light .vn-chip.vn-active { background:var(--positive-bg); border-color:var(--accent-border); color:var(--accent-fg); }
  .p-public-root.p-public-theme-light .vn-chip-caret { color:var(--text-muted); }
  .p-public-root.p-public-theme-light .vn-chip-wrap:hover .vn-chip-caret { color:var(--text-secondary); }
  .p-public-root.p-public-theme-light .vn-chip-wrap.vn-open .vn-chip-caret { color:var(--accent-fg); }
  .p-public-root.p-public-theme-light .vn-dropdown { background:var(--surface-1); border-color:var(--border); box-shadow:0 12px 28px var(--border); }
  .p-public-root.p-public-theme-light .vn-dropdown-head { color:var(--text-muted); border-bottom-color:var(--border-subtle); }
  .p-public-root.p-public-theme-light .vn-dropdown-item { color:var(--text-primary); border-bottom-color:var(--surface-2); }
  .p-public-root.p-public-theme-light .vn-dropdown-item:hover { background:var(--surface-2); }
  .p-public-root.p-public-theme-light .vn-dropdown-item.vn-selected { color:var(--accent-fg); background:var(--positive-bg); }
  .p-public-root.p-public-theme-light .vn-dropdown-item-ico { color:var(--accent-fg); }
  .p-public-root.p-public-theme-light .vn-chip-sep { background:var(--border); }
  .p-public-root.p-public-theme-light .vn-adv { background:var(--surface-1); border-color:var(--border); box-shadow:0 16px 34px var(--border); }
  .p-public-root.p-public-theme-light .vn-adv label { color:var(--text-muted); }
  .p-public-root.p-public-theme-light .vn-adv input[type="number"] { background:var(--surface-1); border-color:var(--border); color:var(--text-primary); }
  .p-public-root.p-public-theme-light .vn-feat,
  .p-public-root.p-public-theme-light .vn-map-sec { border-color:var(--border-subtle); }
  .p-public-user-foot { margin-top:0; }
  .p-public-root.p-public-theme-light .vn-feat-tab { background:var(--surface-1); border-color:var(--border); color:var(--text-secondary); }
  .p-public-root.p-public-theme-light .vn-feat-tab:hover { color:var(--text-primary); border-color:var(--border-strong); }
  .p-public-root.p-public-theme-light .vn-feat-tab.vn-feat-tab-active { background:var(--positive-bg); border-color:var(--accent-border); color:var(--accent-fg); }
  .p-public-root.p-public-theme-light .vn-feat-card,
  .p-public-root.p-public-theme-light .vn-card,
  .p-public-root.p-public-theme-light .vn-map-wrap,
  .p-public-root.p-public-theme-light .vn-skel-card { background:var(--surface-1); border-color:var(--border); box-shadow:0 10px 24px var(--border-subtle); }
  .p-public-root.p-public-theme-light .vn-feat-card-addr,
  .p-public-root.p-public-theme-light .vn-card-addr,
  .p-public-root.p-public-theme-light .vn-results-title,
  .p-public-root.p-public-theme-light .vn-feat-empty,
  .p-public-root.p-public-theme-light .vn-map-loading { color:var(--text-muted); }
  .p-public-root.p-public-theme-light .vn-card-addr svg { color:var(--text-muted); }
  .p-public-root.p-public-theme-light .vn-results-title b { color:var(--text-primary); }
  .p-public-root.p-public-theme-light .vn-card-footer { border-top-color:var(--border-subtle); }
  .p-public-root.p-public-theme-light .vn-skel-img { background:var(--surface-2); }
  .p-public-root.p-public-theme-light .vn-skel-line { background:var(--border-subtle); }
`;

const SPORTS = [
  { value: '', label: 'Todos los deportes' },
  { value: 'football', label: 'Fútbol' },
  { value: 'padel', label: 'Pádel' },
  { value: 'tennis', label: 'Tenis' },
  { value: 'basketball', label: 'Básquet' },
  { value: 'volleyball', label: 'Vóley' },
];
const SPORT_LABELS: Record<string, string> = { football:'Fútbol', padel:'Pádel', tennis:'Tenis', basketball:'Básquet', volleyball:'Vóley' };

type FeatTab = 'top' | 'disc' | 'rated';
type RatingMap = Record<number, { average: number; total: number }>;

function formatAddr(c: Club) {
  return [c.city, c.province].filter(Boolean).join(', ') || c.addressLine || '';
}

function SkeletonCard() {
  return (
    <div className="vn-skel-card vn-skeleton">
      <div className="vn-skel-img" />
      <div className="vn-skel-body">
        <div className="vn-skel-line" style={{ width: '65%' }} />
        <div className="vn-skel-line" style={{ width: '40%' }} />
        <div className="vn-skel-line" style={{ width: '80%' }} />
      </div>
    </div>
  );
}

function RatingBadge({ rating, total }: { rating: number; total: number }) {
  if (!total) return null;
  return (
    <div className="vn-card-rating">
      <Star size={11} fill="var(--brand)" />
      {rating.toFixed(1)} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({total})</span>
    </div>
  );
}

function FeatCard({ club, rating }: { club: Club; rating?: { average: number; total: number } }) {
  return (
    <Link href={`/club/${club.slug}`} className="vn-feat-card">
      <div className="vn-feat-card-img">
        {club.clubImageUrl
          ? <Image src={club.clubImageUrl} alt={club.name} fill style={{ objectFit: 'cover' }} sizes="300px" />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,var(--surface-1),var(--surface-3))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--positive-bg)" strokeWidth="1"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
            </div>
        }
        {rating && rating.total > 0 && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: 'var(--overlay)', backdropFilter: 'blur(6px)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
            <Star size={10} fill="var(--brand)" color="var(--brand)" />{rating.average.toFixed(1)}
          </div>
        )}
      </div>
      <div className="vn-feat-card-body">
        <div className="vn-feat-card-name">{club.name}</div>
        {formatAddr(club) && <div className="vn-feat-card-addr"><MapPin size={10} />{formatAddr(club)}</div>}
        {rating && rating.total > 0 && (
          <div className="vn-feat-card-rating"><Star size={11} fill="var(--brand)" />{rating.average.toFixed(1)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {rating.total} reseña{rating.total !== 1 ? 's' : ''}</span></div>
        )}
      </div>
    </Link>
  );
}

export default function ComplejosPage() {
  const router = useRouter();
  const { isLight } = useUserTheme();
  const searchRef = useRef<HTMLInputElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const mapTileLayerRef = useRef<any>(null);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<RatingMap>({});
  const [search, setSearch] = useState('');
  const [zone, setZone] = useState('');
  const [sport, setSport] = useState('');
  const [showZoneDropdown, setShowZoneDropdown] = useState(false);
  const [showSportDropdown, setShowSportDropdown] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const [featTab, setFeatTab] = useState<FeatTab>('top');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [paramsRead, setParamsRead] = useState(false);

  // Read URL params once router is ready
  useEffect(() => {
    if (!router.isReady || paramsRead) return;
    if (router.query.q) setSearch(String(router.query.q));
    if (router.query.zone) setZone(String(router.query.zone));
    if (router.query.sport) setSport(String(router.query.sport));
    setParamsRead(true);
  }, [router.isReady, paramsRead, router.query.q, router.query.zone, router.query.sport]);

  // Sync filters → URL (shallow, no page reload)
  useEffect(() => {
    if (!paramsRead) return;
    const q: Record<string, string> = {};
    if (search) q.q = search;
    if (zone) q.zone = zone;
    if (sport) q.sport = sport;
    void router.replace({ pathname: '/complejos', query: q }, undefined, { shallow: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, zone, sport, paramsRead]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setShowZoneDropdown(false);
        setShowSportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  // Load clubs + ratings
  useEffect(() => {
    ClubService.getAllClubs()
      .then(async (all) => {
        setClubs(all);
        const ratingResults = await Promise.all(
          all.map(c =>
            getClubReviewsSummary(c.slug)
              .then(s => ({ id: c.id, average: s.averageRating, total: s.count }))
              .catch(() => ({ id: c.id, average: 0, total: 0 }))
          )
        );
        const map: RatingMap = {};
        ratingResults.forEach(r => { map[r.id] = { average: r.average, total: r.total }; });
        setRatings(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load Leaflet from CDN (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined' || mapLoaded) return;
    setMapLoaded(true);
    const leafletCss = document.createElement('link');
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(leafletCss);

    const gestureCss = document.createElement('link');
    gestureCss.rel = 'stylesheet';
    gestureCss.href = 'https://unpkg.com/leaflet-gesture-handling/dist/leaflet-gesture-handling.min.css';
    document.head.appendChild(gestureCss);

    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletScript.onload = () => {
      const gestureScript = document.createElement('script');
      gestureScript.src = 'https://unpkg.com/leaflet-gesture-handling';
      gestureScript.onload = () => setMapReady(true);
      gestureScript.onerror = () => setMapReady(true); // fallback: init map without plugin
      document.head.appendChild(gestureScript);
    };
    leafletScript.onerror = () => setMapReady(false);
    document.head.appendChild(leafletScript);
  }, [mapLoaded]);

  // Initialize map once Leaflet + clubs are ready
  useEffect(() => {
    const L = typeof window !== 'undefined' ? (window as any).L : null;
    if (!mapReady || !L || !mapDivRef.current || leafletMapRef.current || clubs.length === 0) return;

    const map = L.map(mapDivRef.current, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      gestureHandling: true,
      gestureHandlingOptions: {
        duration: 1200,
        text: {
          touch: 'Usa dos dedos para mover el mapa',
          scroll: 'Usa Ctrl + desplazamiento para acercar o alejar el mapa',
          scrollMac: 'Usa ⌘ + desplazamiento para acercar o alejar el mapa',
        },
      },
    })
      .setView([-34.6, -60], 5);

    // Fallback si el plugin no carga: evitar zoom accidental con trackpad/rueda.
    if (!map.gestureHandling) {
      map.scrollWheelZoom.disable();
      map.touchZoom.disable();
    }

    mapTileLayerRef.current = L.tileLayer(
      isLight
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19 }
    ).addTo(map);
    L.control.attribution({ prefix: '© OpenStreetMap · CartoDB' }).addTo(map);
    leafletMapRef.current = map;

    // Pique marker icon
    const markerIcon = (name: string) => L.divIcon({
      className: '',
      html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:var(--brand);border:2px solid var(--brand-on);transform:rotate(-45deg);box-shadow:var(--shadow-md);display:flex;align-items:center;justify-content:center">
        <div style="transform:rotate(45deg);font-size:14px">📍</div>
      </div>
      <div style="position:absolute;top:36px;left:50%;transform:translateX(-50%);background:var(--overlay);color:var(--text-primary);font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;font-family:Geist,system-ui,sans-serif;border:1px solid var(--border)">${name}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -36],
    });

    // Geocode each club and add marker
    clubs.forEach(async (club) => {
      const addr = [club.addressLine, club.city, club.province, 'Argentina'].filter(Boolean).join(', ');
      const coords = await geocode(addr);
      if (!coords || !leafletMapRef.current) return;
      const marker = L.marker([coords.lat, coords.lon], { icon: markerIcon(club.name) }).addTo(map);
      marker.bindPopup(`<div style="font-family:Geist,system-ui,sans-serif;min-width:160px">
        <div style="font-weight:800;font-size:13px;margin-bottom:4px">${club.name}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${formatAddr(club)}</div>
        <a href="/club/${club.slug}" style="display:inline-block;padding:5px 12px;border-radius:8px;background:var(--brand);color:var(--brand-on);font-size:11px;font-weight:800;text-decoration:none">Ver cancha →</a>
      </div>`, { maxWidth: 220 });
    });
  }, [mapReady, clubs, isLight]);

  useEffect(() => {
    const L = typeof window !== 'undefined' ? (window as any).L : null;
    if (!L || !leafletMapRef.current) return;
    if (mapTileLayerRef.current) {
      leafletMapRef.current.removeLayer(mapTileLayerRef.current);
    }
    mapTileLayerRef.current = L.tileLayer(
      isLight
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19 }
    ).addTo(leafletMapRef.current);
  }, [isLight]);

  const zones = useMemo(
    () => [...new Set(clubs.map(c => c.city).filter((c): c is string => Boolean(c)))].sort(),
    [clubs]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs.filter(c => {
      if (q && !`${c.name} ${c.city} ${c.province} ${c.addressLine} ${c.description || ''}`.toLowerCase().includes(q)) return false;
      if (zone && c.city !== zone) return false;
      return true;
    });
  }, [clubs, search, zone]);

  // Featured: top rated (min 1 review), rest show placeholder
  const topRated = useMemo(() =>
    [...clubs]
      .filter(c => (ratings[c.id]?.total || 0) > 0)
      .sort((a, b) => (ratings[b.id]?.average || 0) - (ratings[a.id]?.average || 0))
      .slice(0, 8),
    [clubs, ratings]
  );

  // "Más reservados": show clubs with images first as proxy (no booking count in API)
  const mostBooked = useMemo(() =>
    [...clubs].sort((a, b) => (b.clubImageUrl ? 1 : 0) - (a.clubImageUrl ? 1 : 0)).slice(0, 8),
    [clubs]
  );

  const hasFilters = search || zone || sport;
  const clearFilters = () => {
    setSearch('');
    setZone('');
    setSport('');
    setShowZoneDropdown(false);
    setShowSportDropdown(false);
  };

  return (
    <DarkPageLayout
      title="Complejos · Pique"
      extraCss={PAGE_CSS}
      breadcrumbs={[
        { label: 'Inicio', href: '/' },
        { label: 'Complejos' },
      ]}
    >

      {/* ── HERO ── */}
      <section className="vn-hero">
        <div className="vn-hero-bg" />
        <div className="vn-hero-inner">
          {!loading && (
            <div className="vn-badge">
              <span className="vn-badge-dot" />
              {clubs.length} {clubs.length === 1 ? 'complejo disponible' : 'complejos disponibles'}
            </div>
          )}
          <div className="vn-eyebrow">Explorar complejos</div>
          <h1 className="vn-h1">Encontrá <i>tu próximo turno</i></h1>
          <p className="vn-sub">Filtrá por zona y deporte. Reservá online en segundos, sin llamar.</p>

          <div className="vn-search">
            <span className="vn-search-ico"><Search size={16} /></span>
            <input ref={searchRef} className="vn-search-input" type="text" value={search}
              onChange={e => setSearch(e.target.value)} placeholder="Buscá por nombre, zona o descripción…" autoComplete="off" />
            {search && (
              <button className="vn-search-clear" onClick={() => { setSearch(''); searchRef.current?.focus(); }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div ref={filtersRef} className="vn-filters">
            <div className={`vn-chip-wrap${showZoneDropdown ? ' vn-open' : ''}`} onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={`vn-chip${zone ? ' vn-active' : ''}`}
                onClick={() => {
                  setShowSportDropdown(false);
                  setShowZoneDropdown((prev) => !prev);
                }}
              >
                <MapPin className="vn-chip-ico" />
                {zone || 'Zona'}
                <ChevronDown className="vn-chip-caret" />
              </button>
              {showZoneDropdown && (
                <div className="vn-dropdown">
                  <div className="vn-dropdown-head">Elegí zona</div>
                  <ul className="vn-dropdown-list">
                    <li>
                      <button
                        type="button"
                        className={`vn-dropdown-item${!zone ? ' vn-selected' : ''}`}
                        onClick={() => {
                          setZone('');
                          setShowZoneDropdown(false);
                        }}
                      >
                        <MapPin className="vn-dropdown-item-ico" />
                        Todas las zonas
                      </button>
                    </li>
                    {zones.map((z) => (
                      <li key={z}>
                        <button
                          type="button"
                          className={`vn-dropdown-item${zone === z ? ' vn-selected' : ''}`}
                          onClick={() => {
                            setZone(z);
                            setShowZoneDropdown(false);
                          }}
                        >
                          <MapPin className="vn-dropdown-item-ico" />
                          {z}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className={`vn-chip-wrap${showSportDropdown ? ' vn-open' : ''}`} onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={`vn-chip${sport ? ' vn-active' : ''}`}
                onClick={() => {
                  setShowZoneDropdown(false);
                  setShowSportDropdown((prev) => !prev);
                }}
              >
                <svg className="vn-chip-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2a15 15 0 0 1 0 20M2 12h20" /></svg>
                {sport ? SPORT_LABELS[sport] : 'Deporte'}
                <ChevronDown className="vn-chip-caret" />
              </button>
              {showSportDropdown && (
                <div className="vn-dropdown">
                  <div className="vn-dropdown-head">Elegí deporte</div>
                  <ul className="vn-dropdown-list">
                    {SPORTS.map((option) => (
                      <li key={option.value || 'all'}>
                        <button
                          type="button"
                          className={`vn-dropdown-item${sport === option.value ? ' vn-selected' : ''}`}
                          onClick={() => {
                            setSport(option.value);
                            setShowSportDropdown(false);
                          }}
                        >
                          <svg className="vn-dropdown-item-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2a15 15 0 0 1 0 20M2 12h20" /></svg>
                          {option.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {hasFilters && (
              <>
                <div className="vn-chip-sep" />
                <button type="button" className="vn-chip" onClick={clearFilters}><X size={12} /> Limpiar</button>
              </>
            )}

            <div className="vn-chip-sep" />
            <button type="button" className="vn-adv-btn" onClick={() => setShowAdv(p => !p)}>
              <SlidersHorizontal size={13} /> Más filtros
            </button>
          </div>

          {showAdv && (
            <div className="vn-adv">
              <div>
                <label>Precio mínimo (ARS)</label>
                <input type="number" placeholder="Ej: 5.000" min="0" />
              </div>
              <div>
                <label>Precio máximo (ARS)</label>
                <input type="number" placeholder="Ej: 20.000" min="0" />
              </div>
              <button type="button" className="vn-adv-apply" onClick={() => setShowAdv(false)}>Aplicar</button>
            </div>
          )}
        </div>
      </section>

      {/* ── DESTACADOS ── */}
      {!loading && clubs.length > 0 && (
        <section className="vn-feat">
          <div className="vn-feat-inner">
            <div className="vn-feat-head">
              <div>
                <h2 className="vn-feat-title">Destacados</h2>
                <p className="vn-feat-sub">Los complejos con mejor actividad y valoraciones.</p>
              </div>
              <div className="vn-feat-tabs">
                <button type="button" className={`vn-feat-tab${featTab === 'top' ? ' vn-feat-tab-active' : ''}`} onClick={() => setFeatTab('top')}>
                  <Flame size={13} /> Más reservados
                </button>
                <button type="button" className={`vn-feat-tab${featTab === 'disc' ? ' vn-feat-tab-active' : ''}`} onClick={() => setFeatTab('disc')}>
                  <Tag size={13} /> Descuentos
                </button>
                <button type="button" className={`vn-feat-tab${featTab === 'rated' ? ' vn-feat-tab-active' : ''}`} onClick={() => setFeatTab('rated')}>
                  <Star size={13} /> Mejor valorados
                </button>
              </div>
            </div>

            {featTab === 'top' && (
              <div className="vn-feat-track">
                {mostBooked.length > 0
                  ? mostBooked.map(c => <FeatCard key={c.id} club={c} rating={ratings[c.id]} />)
                  : <div className="vn-feat-empty">Las reservas de la semana aparecerán acá</div>
                }
              </div>
            )}

            {featTab === 'disc' && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Tag size={32} style={{ marginBottom: 12, opacity: .4 }} />
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 6 }}>Próximamente</div>
                <div style={{ fontSize: 13 }}>Los complejos con descuentos activos aparecerán acá.</div>
              </div>
            )}

            {featTab === 'rated' && (
              <div className="vn-feat-track">
                {topRated.length > 0
                  ? topRated.map(c => <FeatCard key={c.id} club={c} rating={ratings[c.id]} />)
                  : <div className="vn-feat-empty">Aún no hay reseñas suficientes para mostrar un ranking.</div>
                }
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── TODOS LOS COMPLEJOS ── */}
      <div className="vn-body">
        <div className="vn-results-head">
          <div className="vn-results-copy">
            <h2 className="vn-results-section-title">Todos los complejos</h2>
            <p className="vn-results-section-sub">Explorá la red completa de complejos disponibles.</p>
          </div>
          <p className="vn-results-title">
            {loading
              ? 'Cargando complejos…'
              : <><b>{filtered.length}</b> {filtered.length === 1 ? 'complejo' : 'complejos'}{hasFilters ? ' encontrados' : ' disponibles'}</>
            }
          </p>
        </div>

        <div className="vn-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.length === 0
            ? (
              <div className="vn-empty">
                <svg className="vn-empty-ico" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                </svg>
                <p className="vn-empty-title">Sin resultados</p>
                <p className="vn-empty-sub">Probá con otros filtros o buscá por otro nombre.</p>
              </div>
            )
            : filtered.map(club => {
              const r = ratings[club.id];
              return (
                <Link key={club.id} href={`/club/${club.slug}`} className="vn-card">
                  <div className="vn-card-img">
                    {club.clubImageUrl
                      ? <Image src={club.clubImageUrl} alt={club.name} fill style={{ objectFit: 'cover' }} sizes="(max-width:720px) 100vw, 380px" />
                      : <div className="vn-card-img-placeholder">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--positive-bg)" strokeWidth="1">
                            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                          </svg>
                        </div>
                    }
                    {club.logoUrl && (
                      <div className="vn-card-logo">
                        <Image src={club.logoUrl} alt="" width={40} height={40} style={{ objectFit: 'contain' }} />
                      </div>
                    )}
                    {r && r.total > 0 && <RatingBadge rating={r.average} total={r.total} />}
                  </div>

                  <div className="vn-card-body">
                    <div className="vn-card-name">{club.name}</div>
                    {formatAddr(club) && (
                      <div className="vn-card-addr"><MapPin size={11} />{formatAddr(club)}</div>
                    )}
                    {club.description && <div className="vn-card-desc">{club.description}</div>}
                    <div className="vn-card-footer">
                      <span className="vn-card-cta">Ver cancha →</span>
                    </div>
                  </div>
                </Link>
              );
            })
          }
        </div>
      </div>

      {/* ── MAPA ── */}
      <section className="vn-map-sec">
        <div className="vn-map-inner">
          <div className="vn-map-head">
            <h2 className="vn-map-title">Mapa de complejos</h2>
            <p className="vn-map-sub">Encontrá el complejo más cercano a vos.</p>
          </div>
          <div className="vn-map-wrap">
            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
            {!mapReady && (
              <div
                className="vn-map-loading"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 12,
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <UserLoadingState mode="inline" message="Cargando mapa..." />
              </div>
            )}
          </div>
        </div>
      </section>

    </DarkPageLayout>
  );
}
