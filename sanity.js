const { createClient } = require('@sanity/client')

// Load environment variables
require('dotenv').config()

// Sanity client
const client = createClient({
    projectId: process.env.SANITY_ID,
    dataset: "production",
    token: process.env.SANITY_TOKEN,
    useCdn: false,
    apiVersion: '2023-05-30'
});

function getMediaNames(post) {
    const nameArray = [];

    if (post.observations) {
        post.observations.forEach(observation => {
            observation.observationMedia.forEach(media => {
                if (media.mediaRecord && media.mediaRecord.name) {
                    nameArray.push(media.mediaRecord.name);
                }
            });
        });
    }

    return nameArray;
}

const syncSanity = async (posts) => {
    try {
        for (const post of posts) {
            if (post.data) {
                // Convert arrays of numbers to arrays of strings
                const rawMaterials = post.data.rawMaterials?.map(item => item.title);
                const processedMaterials = post.data.processedMaterials?.map(item => item.title);
                const topics = post.data.topics?.map(item => item.title);
                const emotions = post.data.emotions?.map(item => item.title);

                // TODO: check for undefined
                const doc = {
                    _id: "collection-item-" + post.id,
                    _type: 'collectionItem',
                    title: post.data.titles?.en || "",
                    title_fr: post.data.titles?.fr || "",
                    title_de: post.data.titles?.de || "",
                    story_en: post.data.cleanStories?.en || "",
                    story_fr: post.data.cleanStories?.fr || "",
                    story_de: post.data.cleanStories?.de || "",
                    habitat: post.data.habitats[0] || "",
                    location: post.data.location || "",
                    // species: data.species[0],  // assuming it is an array and you need the first element
                    rawMaterials,
                    processedMaterials,
                    media: getMediaNames(post),
                    // media: post.data.observations?.map(observation => observation.observationMedia?.map(mediaRecord => mediaRecord.name)) || [],
                    topics,
                    emotions,
                    date: new Date(post.created_at),
                    uploaderName: post.user_id.toString(),
                    slug: {
                        _type: 'slug',
                        current: post.data.titles?.en.split(' ').join('-').toLowerCase(),
                    },
                };

                // TODO: Add media: observations => observationsMedia => mediaRecord.name

                const response = await client.createOrReplace(doc);
                console.log('Document created with ID:', response._id);
            }
        }
    } catch (err) {
        console.error('Error importing data: ', err);
    }
};

module.exports = {
    syncSanity
}

