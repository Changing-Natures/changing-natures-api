require('dotenv').config();
const express = require('express');
const { syncSanity } = require('./sanity');
const mysql = require('mysql2');
const app = express();
const port = 3000;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

const promisePool = pool.promise();

const REFERENCE_FIELDS = ['topics', 'rawMaterials', 'processedMaterials', 'practices', 'emotions'];

async function getAssociatedData(data, field) {
    if (data[field] && data[field].length > 0) {
        // All associated data is stored in the open_list_values table
        const [rows] = await promisePool.query(`SELECT * FROM open_list_values WHERE id IN (?)`, [data[field]]);
        data[field] = rows;
    }
    return data;
}

// Raw participation data (all records)
app.get('/participations', async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT * FROM participations');
        res.json(rows);
    } catch (err) {
        console.error('An error occurred while retrieving data:', err);
        res.status(500).send('An error occurred while retrieving data.');
    }
});

// Participation data with associated data & media (all records)
app.get('/participations/embedded', async (req, res) => {
    try {
        const [participations] = await promisePool.query('SELECT * FROM participations');

        // Fetch the associated data and linked observations and media for each participation
        const promises = participations.map(async (participation) => {
            const data = JSON.parse(participation.data);
            for (const field of REFERENCE_FIELDS) {
                participation.data = await getAssociatedData(data, field);
            }

            const [observations] = await promisePool.query('SELECT * FROM observations WHERE participation_id = ?', [participation.id]);
            const observationPromises = observations.map(async (observation) => {
                const [observationMedia] = await promisePool.query('SELECT * FROM observations_medias WHERE observation_id = ?', [observation.id]);
                const mediaPromises = observationMedia.map(async (media) => {
                    const [mediaRecord] = await promisePool.query('SELECT * FROM medias WHERE id = ?', [media.media_id]);
                    media.mediaRecord = mediaRecord[0];
                });
                await Promise.all(mediaPromises);
                observation.observationMedia = observationMedia;
            });
            await Promise.all(observationPromises);
            participation.observations = observations;

            return participation;
        });

        const results = await Promise.all(promises);
        res.json(results);
    } catch (err) {
        console.error('An error occurred while retrieving data:', err);
        res.status(500).send('An error occurred while retrieving data.');
    }
});

// Raw participation data (single by id)
app.get('/participations/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await promisePool.query('SELECT * FROM participations WHERE id = ?', [id]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).send('No record found with the provided ID.');
        }
    } catch (err) {
        console.error('An error occurred while retrieving data:', err);
        res.status(500).send('An error occurred while retrieving data.');
    }
});

// Participation data with associated data & media (single by id)
app.get('/participations/:id/embedded', async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await promisePool.query('SELECT * FROM participations WHERE id = ?', [id]);
        if (rows.length > 0) {
            const participation = rows[0];
            const data = JSON.parse(participation.data);

            // Fetch the associated data for each field
            for (const field of REFERENCE_FIELDS) {
                participation.data = await getAssociatedData(data, field);
            }

            // Fetch the linked observations
            const [observations] = await promisePool.query('SELECT * FROM observations WHERE participation_id = ?', [id]);

            // Fetch the linked observation media and media records for each observation
            for (const observation of observations) {
                const [observationMedia] = await promisePool.query('SELECT * FROM observations_medias WHERE observation_id = ?', [observation.id]);
                observation.observationMedia = observationMedia;
                for (const media of observationMedia) {
                    const [mediaRecord] = await promisePool.query('SELECT * FROM medias WHERE id = ?', [media.media_id]);
                    media.mediaRecord = mediaRecord[0];
                }
            }
            participation.observations = observations;

            res.json(participation);
        } else {
            res.status(404).send('No record found with the provided ID.');
        }
    } catch (err) {
        console.error('An error occurred while retrieving data:', err);
        res.status(500).send('An error occurred while retrieving data.');
    }
});

app.get('/sync', async (req, res) => {
    try {
        const [participations] = await promisePool.query('SELECT * FROM participations');

        // Fetch the associated data and linked observations and media for each participation
        const promises = participations.map(async (participation) => {
            const data = JSON.parse(participation.data);
            for (const field of REFERENCE_FIELDS) {
                participation.data = await getAssociatedData(data, field);
            }

            const [observations] = await promisePool.query('SELECT * FROM observations WHERE participation_id = ?', [participation.id]);
            const observationPromises = observations.map(async (observation) => {
                const [observationMedia] = await promisePool.query('SELECT * FROM observations_medias WHERE observation_id = ?', [observation.id]);
                const mediaPromises = observationMedia.map(async (media) => {
                    const [mediaRecord] = await promisePool.query('SELECT * FROM medias WHERE id = ?', [media.media_id]);
                    media.mediaRecord = mediaRecord[0];
                });
                await Promise.all(mediaPromises);
                observation.observationMedia = observationMedia;
            });
            await Promise.all(observationPromises);
            participation.observations = observations;

            return participation;
        });

        const results = await Promise.all(promises);
        await syncSanity(results);
        res.json(results);
    } catch (err) {
        console.error('An error occurred while retrieving data:', err);
        res.status(500).send('An error occurred while retrieving data.');
    }

})

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
