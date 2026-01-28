const KnowledgeService = require('../desktop-app/src/services/KnowledgeService');
const db = require('../desktop-app/src/database');

(async () => {
    console.log('--- Force Ingestion: Relearning Documents ---');
    try {
        // Ensure settings are loaded or mocked if needed
        // KnowledgeService reads from db.getSettings() internally in ingestAll if customPath is not provided.

        await KnowledgeService.initialize();

        console.log('Starting ingestion process...');
        const result = await KnowledgeService.ingestAll();

        console.log('Ingestion Result:', JSON.stringify(result, null, 2));

    } catch (e) {
        console.error('Ingestion Failed:', e);
    }
})();
