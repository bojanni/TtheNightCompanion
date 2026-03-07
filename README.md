# NightCompanion

Purpose
NightCafe Companion is a powerful desktop application designed for AI art creators who use NightCafe AI. It serves as your complete workflow management hub, helping you organize prompts, track results, analyze what works, and continuously improve your AI art generation process. Whether you're a hobbyist exploring AI art or a professional managing large creative projects, NightCafe Companion streamlines your entire creative pipeline.
What It Does
NightCafe Companion transforms the scattered process of AI art creation into an organized, data-driven workflow. Instead of losing track of successful prompts or manually testing different models, you get a centralized system that remembers everything, learns from your style, and helps you make better creative decisions.
Core Features
🎨 AI-Powered Prompt Generator

Smart Prompt Creation: Generate high-quality prompts from simple descriptions using multiple AI providers (OpenAI, Gemini, Anthropic, OpenRouter)
Intelligent Improvement: Enhance existing prompts with AI-powered suggestions that add technical details, better lighting descriptions, and artistic modifiers
Negative Prompt Generation: Automatically generate optimized negative prompts to exclude unwanted elements
Multi-Provider Support: Switch between different AI models for generation vs. improvement tasks
Local LLM Integration: Connect to Ollama or LM Studio for offline prompt generation
Fragment-Based Generator: Build prompts from curated components (subjects, styles, lighting, atmosphere)
Prompt Variations: Generate multiple creative variations of your prompts with different artistic directions

📝 Comprehensive Prompt Library

Organized Storage: Save unlimited prompts with titles, tags, and detailed metadata
Version Control: Track changes to prompts over time with full version history
Quick Search: Find prompts instantly with text search and tag filtering
Bulk Operations: Edit, delete, or export multiple prompts at once
Custom Tags: Organize prompts with your own tagging system
Title & Tag AI Suggestions: Let AI suggest meaningful titles and relevant tags for your prompts

👥 Character Management

Consistent Characters: Define reusable character descriptions for consistent appearances across generations
Detail Tracking: Store appearance, clothing, personality traits, and reference images
Quick Insertion: Add character descriptions to prompts with a single click
AI Character Analysis: Upload reference images and let AI generate detailed character descriptions
Character Gallery: Visual gallery view of all your characters with image previews

🖼️ Gallery & Results Tracking

Generation History: Keep records of all your generated images with their exact prompts and settings
Model Tracking: Know which NightCafe model was used for each generation
Success Analysis: Rate and tag successful generations to identify patterns
Image Storage: Store reference images and generated results together
Batch Image Analysis: Use AI to analyze multiple generated images and extract insights

🧪 Batch Testing System

A/B Testing: Test multiple prompt variations simultaneously
Model Comparison: Compare results across different NightCafe models with the same prompt
Parameter Testing: Experiment with different settings and track results
Performance Metrics: Track success rates, quality scores, and generation times
Result Visualization: Side-by-side comparison of test results

🎯 Model Recommender

AI Model Selection: Get AI-powered recommendations for which NightCafe model best fits your prompt
Budget Awareness: Factor in credit costs when recommending models
Strength Analysis: Understand each model's strengths and ideal use cases
Keyword Matching: Intelligent analysis of prompt keywords to suggest optimal models
Preset Suggestions: Get recommended preset settings for each model

🔍 Style Profile & Analysis

Pattern Recognition: AI analyzes your prompt history to identify your unique artistic style
Theme Extraction: Discover recurring themes, subjects, and techniques in your work
Style Signature: Get a concise description of your artistic identity
Keyword Frequency: See which terms you use most often across all prompts
Growth Suggestions: Receive AI recommendations for expanding your creative range
Portfolio Overview: Track your evolution as an AI artist over time

💰 Cost Calculator

Credit Estimation: Calculate NightCafe credit costs before generation
Model Pricing: Compare costs across different models and quality settings
Batch Cost Analysis: Estimate total costs for batch testing projects
Budget Planning: Track spending and plan projects within credit budgets
Cost Optimization: Identify the most cost-effective models for your needs

🛠️ AI Creative Tools

Prompt Improvement: Enhance prompts with detailed AI analysis and suggestions
Style Analysis: Get in-depth analysis of your artistic patterns
Troubleshooting: Diagnose why prompts might not be working and get fixes
Random Inspiration: Generate completely random prompts for creative exploration
Model Optimization: Optimize prompts specifically for chosen NightCafe models

📊 Data Management

Complete Backup: Export all your data (prompts, characters, gallery, tests) to JSON
Data Import: Restore from backups or migrate data between installations
Database Browser: View and query your local PostgreSQL database
Secure Storage: All API keys encrypted with AES-256-GCM before storage
Local-First: Your data stays on your computer, private and under your control

⚙️ Settings & Configuration

Multi-Provider API Management: Configure API keys for OpenAI, Gemini, Anthropic, and OpenRouter
Local LLM Endpoints: Connect to Ollama or LM Studio for offline operation
Separate Models: Use different models for prompt generation vs. improvement
Active Provider Selection: Choose which AI provider powers each feature
Secure Encryption: API keys are encrypted and never stored in plain text

Technical Architecture
Desktop Application

Electron Framework: Cross-platform desktop app (Windows, macOS, Linux)
React 18 with TypeScript for modern, type-safe UI development
Vite for fast development and optimized builds
Tailwind CSS for beautiful, responsive design
React Query for efficient server state management
React Router for navigation

Local Backend

Express Server: Lightweight Node.js API server
PostgreSQL Database: Robust, local data storage
AES-256-GCM Encryption: Secure API key storage
Node Crypto: Built-in encryption without external dependencies
CORS Enabled: Secure communication between Electron app and local server

AI Integration

Multiple Providers: OpenAI (GPT, DALL-E), Google Gemini, Anthropic Claude, OpenRouter
Local LLMs: Ollama and LM Studio support for offline operation
Fallback System: Automatic provider fallback if primary fails
Streaming Support: Real-time responses for better UX
Vision Capabilities: Image analysis with multimodal models

Data Storage

Local PostgreSQL: All data stored locally on your computer
Relational Schema: Properly structured database with foreign keys and indexes
Migration Scripts: Easy setup and schema updates
JSON Export/Import: Portable backup format
No Cloud Dependency: Complete offline capability after initial AI provider setup

Why Choose NightCafe Companion?
For Beginners

Learn Faster: See what works and build on successful prompts
AI Assistance: Let AI help you write better prompts from day one
Cost Awareness: Understand credit costs before spending
Pattern Recognition: Discover your emerging style automatically

For Experienced Users

Advanced Testing: Batch test multiple approaches systematically
Data-Driven Decisions: Track what works across thousands of generations
Workflow Optimization: Speed up your creative process significantly
Portfolio Management: Organize and analyze your entire body of work

For Professionals

Character Consistency: Maintain brand-consistent characters across projects
Project Management: Organize prompts by client, project, or campaign
Cost Tracking: Monitor and optimize AI generation spending
Style Profiles: Develop and maintain distinct artistic voices
Collaboration Ready: Export and share prompt libraries with teams

Privacy & Security

Local-First Architecture: Your data never leaves your computer
Encrypted API Keys: All credentials encrypted with AES-256-GCM
No Telemetry: No tracking, no analytics, no data collection
Open Database: Direct access to your PostgreSQL database
Portable Backups: Export everything to JSON for complete control

Getting Started

Install: Download and run the NightCafe Companion installer for your OS
Database Setup: Run the included PostgreSQL setup script
Add API Keys: Configure at least one AI provider in Settings
Create Your First Prompt: Use the Generator to create or improve a prompt
Track Results: Add generated images to your Gallery with metadata
Discover Your Style: After saving 10+ prompts, run a Style Analysis

System Requirements

Operating System: Windows 11, macOS 11+, or Linux (Ubuntu 20.04+)
RAM: 4GB minimum, 8GB recommended
Storage: 500MB for application, additional space for database
PostgreSQL: Version 13+ (included in setup scripts)
Internet: Required only for AI provider API calls

Schema Governance

To prevent schema drift between `create-schema.sql` and `server/db-init.js`, keep this workflow:

1. Add table/column definitions to `create-schema.sql` first.
2. Mirror backward-compatible evolution in `server/db-init.js` (`CREATE TABLE IF NOT EXISTS` + `addColumn(...)`).
3. Run `npm run schema:drift-check` locally before commit.

CI enforces this with `.github/workflows/schema-drift-check.yml`, so pull requests fail when drift is detected.

Versioned Migrations (Foundation)

The repository now includes a versioned SQL migration pipeline under `server/migrations/`.

- Run migrations: `npm run db:migrate`
- Show migration status: `npm run db:migrate:status`

Notes:

1. This is intentionally non-breaking: `server/db-init.js` remains the bootstrap path for fresh installs.
2. New incremental schema changes should be added as SQL files in `server/migrations/`.
3. Keep `create-schema.sql` and `server/db-init.js` aligned until migration-first bootstrapping is fully adopted.

Future Enhancements

Prompt Templates: Save and reuse complex prompt structures
Advanced Analytics: Token counting and detailed cost breakdowns
Auto-Updates: Automatic application updates
Bulk Operations: Process hundreds of prompts at once
Template Marketplace: Share and discover prompt templates
Native Integration: Deeper OS integration for drag-and-drop


Built for AI Artists, by AI Artists
NightCafe Companion is designed to solve real workflow challenges faced by AI art creators. Whether you're managing a personal portfolio or running a commercial AI art operation, this tool helps you work smarter, not harder.
