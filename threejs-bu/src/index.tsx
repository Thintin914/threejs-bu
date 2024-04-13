import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient("https://qqehknuyavzusmohxfbv.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZWhrbnV5YXZ6dXNtb2h4ZmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk3ODgwMzMsImV4cCI6MjAyNTM2NDAzM30.oJxU1boI1RoOYBSyEWvkmkEo_Gq9VxZ1qeY4_vu_k5U");
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <App />
);