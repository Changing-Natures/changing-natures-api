require('dotenv').config()
const { createClient } = require('@sanity/client')

// Sanity client
const client = createClient({
    projectId: process.env.SANITY_ID,
    dataset: "production",
    token: process.env.SANITY_TOKEN,
    useCdn: false,
    apiVersion: '2023-05-30'
});

/**
 * Extracts media names from a post object, iterating through its observations and associated media.
 * @param {Object} post - The post object which may contain observations and associated media records.
 * @returns {string[]} An array of media names.
 */
function getMediaNames(post) {
    const nameArray = [];

    if (post.observations) {
        post.observations.forEach(observation => {
            if (observation.observationMedia) {
                observation.observationMedia.forEach(media => {
                    if (media.mediaRecord && media.mediaRecord.name) {
                        nameArray.push(media.mediaRecord.name);
                    }
                });
            }
        });
    }

    return nameArray;
}

/**
 * Synchronizes a list of posts to Sanity, either creating or updating existing documents based on post data.
 * @async
 * @function
 * @param {Object[]} posts - Array of posts to synchronize.
 * @returns {void}
 */
const syncSanity = async (posts) => {
    try {
        for (const post of posts) {
            if (post.data) {
                // Convert arrays of numbers to arrays of strings
                const rawMaterials = post.data.rawMaterials?.map(item => item.title);
                const processedMaterials = post.data.processedMaterials?.map(item => item.title);
                const topics = post.data.topics?.map(item => item.title);
                const emotions = post.data.emotions?.map(item => item.title);
                const practices = post.data.practices?.map(item => item.title);
                const events = post.events;

                const doc = {
                    _id: "collection-item-" + post.id,
                    _type: 'collectionItem',
                    collectionItemId: post.id,
                    title: post.data.titles?.en || "",
                    // ... (rest of the fields remain unchanged)
                    slug: {
                        _type: 'slug',
                        current: post.data.titles?.en?.split(' ').join('-').toLowerCase() || "",
                    },
                };

                // Check if document already exists
                const existingDoc = await client.fetch(`*[_id == "${doc._id}"]`);

                if (existingDoc.length === 0) {
                    // Document doesn't exist, create it
                    const response = await client.create(doc);
                    console.log('Document created with ID:', response._id);
                } else {
                    // Document exists, patch it
                    const response = await client
                        .patch(doc._id)
                        .set(doc)
                        .commit();
                    console.log('Document updated with ID:', response._id);
                }
            }
        }
    } catch (err) {
        console.error('Error importing data: ', err);
    }
};

module.exports = {
    syncSanity
}

