import { createClient } from "@supabase/supabase-js";

// SuperCool managed database (public url + anon key).
const url = "https://prj6152f2c18a9717d3bdac.databasepad.com";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjE2ZDg5MjBhLWViMGYtNDhkOC04YzY5LTIzOTRhNjU5YTIxZiJ9.eyJwcm9qZWN0SWQiOiJwcmo2MTUyZjJjMThhOTcxN2QzYmRhYyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzkwMzA2MDQzLCJleHAiOjIxMDU2NjYwNDMsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.CKmxQ7qjoF6y1cjl2nFpCpFRVK38cRpanI_XJgj_yLw";

export const db = createClient(url, anonKey);
export default db;
