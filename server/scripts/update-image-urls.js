const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'nightcafe_companion',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

// Extract date from timestamp filename (format: timestamp-random.ext)
function getDateFromFilename(filename) {
    const match = filename.match(/^(\d{13})-/);
    if (match) {
        const timestamp = parseInt(match[1], 10);
        return new Date(timestamp);
    }
    return null;
}

// Get year/month path from date
function getYearMonthPath(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}/${month}`;
}

// Update URL to include year/month path
function updateUrl(url) {
    if (!url) return url;
    
    // Check if URL already has year/month path
    if (url.match(/\/uploads\/(images|videos)\/\d{4}\/\d{2}\//)) {
        return url; // Already has year/month path
    }
    
    // Extract filename from URL
    const match = url.match(/\/uploads\/(images|videos)\/([^\/]+)$/);
    if (!match) return url;
    
    const [, subdir, filename] = match;
    const date = getDateFromFilename(filename);
    if (!date) return url;
    
    const yearMonth = getYearMonthPath(date);
    const baseUrl = url.substring(0, url.lastIndexOf(`/${subdir}/`) + `/${subdir}/`.length);
    return `${baseUrl}${yearMonth}/${filename}`;
}

async function updateImageUrls() {
    const client = await pool.connect();
    
    try {
        console.log('Starting URL updates...\n');
        
        // Update gallery_items table
        console.log('Updating gallery_items...');
        const galleryResult = await client.query('SELECT id, image_url, video_url, thumbnail_url FROM gallery_items');
        let galleryUpdated = 0;
        
        for (const item of galleryResult.rows) {
            const updates = {};
            
            if (item.image_url) {
                const newUrl = updateUrl(item.image_url);
                if (newUrl !== item.image_url) {
                    updates.image_url = newUrl;
                }
            }
            
            if (item.video_url) {
                const newUrl = updateUrl(item.video_url);
                if (newUrl !== item.video_url) {
                    updates.video_url = newUrl;
                }
            }
            
            if (item.thumbnail_url) {
                const newUrl = updateUrl(item.thumbnail_url);
                if (newUrl !== item.thumbnail_url) {
                    updates.thumbnail_url = newUrl;
                }
            }
            
            if (Object.keys(updates).length > 0) {
                const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
                const values = [...Object.values(updates), item.id];
                await client.query(`UPDATE gallery_items SET ${setClause} WHERE id = $${values.length}`, values);
                galleryUpdated++;
                console.log(`  Updated gallery_item ${item.id}:`, updates);
            }
        }
        console.log(`Updated ${galleryUpdated} gallery_items\n`);
        
        // Update characters table (reference_image_url and images JSONB)
        console.log('Updating characters...');
        const charResult = await client.query('SELECT id, reference_image_url, images FROM characters');
        let charUpdated = 0;
        
        for (const char of charResult.rows) {
            let hasUpdates = false;
            const updates = {};
            
            if (char.reference_image_url) {
                const newUrl = updateUrl(char.reference_image_url);
                if (newUrl !== char.reference_image_url) {
                    updates.reference_image_url = newUrl;
                    hasUpdates = true;
                }
            }
            
            // Update images array in JSONB
            if (char.images && Array.isArray(char.images)) {
                const updatedImages = char.images.map(img => {
                    if (img.url) {
                        const newUrl = updateUrl(img.url);
                        if (newUrl !== img.url) {
                            hasUpdates = true;
                            return { ...img, url: newUrl };
                        }
                    }
                    return img;
                });
                
                if (hasUpdates) {
                    updates.images = JSON.stringify(updatedImages);
                }
            }
            
            if (Object.keys(updates).length > 0) {
                const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
                const values = [...Object.values(updates), char.id];
                await client.query(`UPDATE characters SET ${setClause} WHERE id = $${values.length}`, values);
                charUpdated++;
                console.log(`  Updated character ${char.id}:`, Object.keys(updates));
            }
        }
        console.log(`Updated ${charUpdated} characters\n`);
        
        // Update batch_test_results table
        console.log('Updating batch_test_results...');
        const batchResult = await client.query('SELECT id, image_url FROM batch_test_results');
        let batchUpdated = 0;
        
        for (const item of batchResult.rows) {
            if (item.image_url) {
                const newUrl = updateUrl(item.image_url);
                if (newUrl !== item.image_url) {
                    await client.query('UPDATE batch_test_results SET image_url = $1 WHERE id = $2', [newUrl, item.id]);
                    batchUpdated++;
                    console.log(`  Updated batch_test_result ${item.id}`);
                }
            }
        }
        console.log(`Updated ${batchUpdated} batch_test_results\n`);
        
        // Update prompts table (start_image column)
        console.log('Updating prompts (start_image)...');
        const promptResult = await client.query('SELECT id, start_image FROM prompts WHERE start_image IS NOT NULL');
        let promptUpdated = 0;
        
        for (const item of promptResult.rows) {
            const newUrl = updateUrl(item.start_image);
            if (newUrl !== item.start_image) {
                await client.query('UPDATE prompts SET start_image = $1 WHERE id = $2', [newUrl, item.id]);
                promptUpdated++;
                console.log(`  Updated prompt ${item.id}`);
            }
        }
        console.log(`Updated ${promptUpdated} prompts\n`);
        
        console.log('✅ URL updates complete!');
        console.log(`\nSummary:`);
        console.log(`  - gallery_items: ${galleryUpdated}`);
        console.log(`  - characters: ${charUpdated}`);
        console.log(`  - batch_test_results: ${batchUpdated}`);
        console.log(`  - prompts: ${promptUpdated}`);
        
    } catch (error) {
        console.error('Error updating URLs:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

updateImageUrls();
