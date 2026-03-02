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

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

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

// Find file in uploads directory
function findFile(filename) {
    // Check in images subdirectories
    const imagesDir = path.join(UPLOADS_DIR, 'images');
    if (fs.existsSync(imagesDir)) {
        const years = fs.readdirSync(imagesDir);
        for (const year of years) {
            const yearPath = path.join(imagesDir, year);
            if (fs.statSync(yearPath).isDirectory()) {
                const months = fs.readdirSync(yearPath);
                for (const month of months) {
                    const monthPath = path.join(yearPath, month);
                    if (fs.statSync(monthPath).isDirectory()) {
                        const filePath = path.join(monthPath, filename);
                        if (fs.existsSync(filePath)) {
                            return `images/${year}/${month}/${filename}`;
                        }
                    }
                }
            }
        }
    }
    
    // Check in videos subdirectories
    const videosDir = path.join(UPLOADS_DIR, 'videos');
    if (fs.existsSync(videosDir)) {
        const years = fs.readdirSync(videosDir);
        for (const year of years) {
            const yearPath = path.join(videosDir, year);
            if (fs.statSync(yearPath).isDirectory()) {
                const months = fs.readdirSync(yearPath);
                for (const month of months) {
                    const monthPath = path.join(yearPath, month);
                    if (fs.statSync(monthPath).isDirectory()) {
                        const filePath = path.join(monthPath, filename);
                        if (fs.existsSync(filePath)) {
                            return `videos/${year}/${month}/${filename}`;
                        }
                    }
                }
            }
        }
    }
    
    // Check flat directories (legacy)
    const flatImagePath = path.join(imagesDir, filename);
    if (fs.existsSync(flatImagePath)) {
        return `images/${filename}`;
    }
    
    const flatVideoPath = path.join(videosDir, filename);
    if (fs.existsSync(flatVideoPath)) {
        return `videos/${filename}`;
    }
    
    return null;
}

// Extract filename from URL
function extractFilename(url) {
    if (!url) return null;
    const match = url.match(/\/uploads\/(.+)$/);
    if (match) {
        const pathPart = match[1];
        // If it's just a filename (no subdirs), return it
        if (!pathPart.includes('/')) {
            return pathPart;
        }
    }
    return null;
}

// Update URL with correct path
function buildCorrectUrl(originalUrl, relativePath) {
    if (!originalUrl || !relativePath) return originalUrl;
    const baseUrl = originalUrl.substring(0, originalUrl.indexOf('/uploads/') + '/uploads/'.length);
    return `${baseUrl}${relativePath}`;
}

async function fixMissingImagePaths() {
    const client = await pool.connect();
    
    try {
        console.log('Scanning for missing image paths...\n');
        
        const tables = [
            { name: 'gallery_items', columns: ['image_url', 'video_url', 'thumbnail_url'] },
            { name: 'characters', columns: ['reference_image_url'] },
            { name: 'batch_test_results', columns: ['image_url'] },
            { name: 'prompts', columns: ['start_image'] }
        ];
        
        let totalFixed = 0;
        let totalMissing = 0;
        
        for (const table of tables) {
            console.log(`Checking ${table.name}...`);
            
            for (const column of table.columns) {
                const result = await client.query(`
                    SELECT id, ${column} 
                    FROM ${table.name} 
                    WHERE ${column} IS NOT NULL 
                    AND ${column} LIKE '%/uploads/%'
                    AND ${column} NOT LIKE '%/uploads/images/%'
                    AND ${column} NOT LIKE '%/uploads/videos/%'
                `);
                
                for (const row of result.rows) {
                    const url = row[column];
                    const filename = extractFilename(url);
                    
                    if (filename) {
                        const relativePath = findFile(filename);
                        
                        if (relativePath) {
                            const newUrl = buildCorrectUrl(url, relativePath);
                            
                            if (newUrl !== url) {
                                await client.query(
                                    `UPDATE ${table.name} SET ${column} = $1 WHERE id = $2`,
                                    [newUrl, row.id]
                                );
                                console.log(`  ✓ Fixed ${table.name}.${column} ${row.id}:`);
                                console.log(`    ${url}`);
                                console.log(`    → ${newUrl}`);
                                totalFixed++;
                            }
                        } else {
                            console.log(`  ✗ File not found for ${table.name}.${column} ${row.id}: ${filename}`);
                            totalMissing++;
                        }
                    }
                }
            }
            console.log('');
        }
        
        // Also check and fix characters.images JSONB array
        console.log('Checking characters.images JSONB array...');
        const charResult = await client.query(`
            SELECT id, images 
            FROM characters 
            WHERE images IS NOT NULL 
            AND jsonb_array_length(images) > 0
        `);
        
        for (const row of charResult.rows) {
            let hasUpdates = false;
            const updatedImages = row.images.map(img => {
                if (img.url && img.url.includes('/uploads/') && 
                    !img.url.includes('/uploads/images/') && 
                    !img.url.includes('/uploads/videos/')) {
                    const filename = extractFilename(img.url);
                    if (filename) {
                        const relativePath = findFile(filename);
                        if (relativePath) {
                            const newUrl = buildCorrectUrl(img.url, relativePath);
                            if (newUrl !== img.url) {
                                hasUpdates = true;
                                console.log(`  ✓ Fixed characters.images ${row.id}: ${img.url} → ${newUrl}`);
                                totalFixed++;
                                return { ...img, url: newUrl };
                            }
                        } else {
                            console.log(`  ✗ File not found for characters.images ${row.id}: ${filename}`);
                            totalMissing++;
                        }
                    }
                }
                return img;
            });
            
            if (hasUpdates) {
                await client.query(
                    'UPDATE characters SET images = $1 WHERE id = $2',
                    [JSON.stringify(updatedImages), row.id]
                );
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ Fix complete!');
        console.log(`   Fixed: ${totalFixed} URLs`);
        console.log(`   Missing files: ${totalMissing}`);
        
    } catch (error) {
        console.error('Error fixing URLs:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixMissingImagePaths();
