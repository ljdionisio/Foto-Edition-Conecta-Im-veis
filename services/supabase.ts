import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mkiyxzeklnwaornvpvpw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1raXl4emVrbG53YW9ybnZwdnB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NDU3MDUsImV4cCI6MjA3OTUyMTcwNX0.guh2BQ7uU1zkEUAtFGXHR4RxxgX6yPj6fGqF96Mwt28';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);