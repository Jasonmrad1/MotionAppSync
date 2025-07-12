const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jfshmpnmyjtzfyqpmohc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmc2htcG5teWp0emZ5cXBtb2hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjMwODkzMSwiZXhwIjoyMDY3ODg0OTMxfQ.L2Hkg8oZ-4VXhXU52n-bgevL6t4yx-2eQvumlygSoRQ'; // Use service role key from Supabase dashboard

const supabase = createClient(supabaseUrl, supabaseKey);

const apiBase = 'https://exercisedb.p.rapidapi.com/exercises';
const headers = {
  "X-RapidAPI-Key": "dd668cd173msh87b29db262a02cfp1b6f08jsncf7782b3545d",
  "X-RapidAPI-Host": "exercisedb.p.rapidapi.com"
};

const limit = 100;
const totalExercises = 1300; // Approximate total count; adjust if needed
const batchCount = Math.ceil(totalExercises / limit);
const delayMs = 1000; // Delay 1 second between batch requests, adjust as needed
const maxRetries = 3;

// Utility to delay in async functions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch a batch with retry logic
async function fetchBatch(offset, attempt = 1) {
  const url = `${apiBase}?limit=${limit}&offset=${offset}`;
  try {
    console.log(`Fetching batch offset=${offset}, attempt ${attempt}`);
    const res = await axios.get(url, { headers });
    return res.data;
  } catch (error) {
    console.error(`Fetch failed at offset ${offset} (attempt ${attempt}): ${error.message}`);
    if (attempt < maxRetries) {
      await delay(2000); // Wait 2 seconds before retrying
      return fetchBatch(offset, attempt + 1);
    } else {
      throw new Error(`Failed to fetch batch at offset ${offset} after ${maxRetries} attempts.`);
    }
  }
}

async function syncGifs() {
  try {
    let allGifs = [];

    for (let i = 0; i < batchCount; i++) {
      const offset = i * limit;
      const exercises = await fetchBatch(offset);
      console.log(`Fetched ${exercises.length} exercises for batch ${i + 1}/${batchCount}`);

      const gifs = exercises.map(e => ({
        id: e.id,
        gifUrl: e.gifUrl,
        updated_at: new Date().toISOString(),
      }));

      allGifs = allGifs.concat(gifs);

      // Delay between batches to avoid rate limiting
      if (i < batchCount - 1) {
        await delay(delayMs);
      }
    }

    console.log(`Upserting ${allGifs.length} gif URLs to Supabase...`);

    const { data, error } = await supabase
      .from('exercise_gifs')
      .upsert(allGifs, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting gifs:', error);
    } else {
      console.log(`Sync completed successfully. Upserted ${data.length} records.`);
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

(async () => {
  await syncGifs();
})();
