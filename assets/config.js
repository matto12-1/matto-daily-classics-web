// assets/config.js: 서비스 전역 상수. 이름·URL은 여기 한 곳만 바꾼다.
export const SITE_NAME = "매일 읽는 고전";
export const SITE_TAGLINE = "매일 아침 20분, 고전 한 장";
export const SITE_URL = "https://classics.matto.kr/";

// 제품 목록·연락처·태그라인은 공용 저장소로 갔다: assets/brand/products.js
// (원본은 f:/VibeCoding/promo/mattolab-brand/products.js)
export const TIMEZONE_OFFSET_MIN = 9 * 60; // KST

// 조회수: 아침신문과 같은 Supabase 프로젝트에 classics 스키마로 격리. 근거: docs/supabase-views.sql
export const SUPABASE_URL = "https://wyoojgbtutwveouhexiw.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5b29qZ2J0dXR3dmVvdWhleGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDY4MDAsImV4cCI6MjA5NzcyMjgwMH0.u1Im8LHGNTRCNJv8EI0EFBgtIw2WCUK25n3HUXZNS8k";
export const RPC_BUMP = "dc_bump_view";
export const RPC_GET = "dc_get_views";
