const YOUTUBE_API_ENDPOINT = "https://www.googleapis.com/youtube/v3";

export const YouTubeService = {
    // Search Videos
    searchVideos: async (query, apiKey) => {
        if (!apiKey) throw new Error("No API Key provided");

        const url = `${YOUTUBE_API_ENDPOINT}/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "YouTube search failed");
        }

        const data = await response.json();

        return data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            artist: item.snippet.channelTitle, // Best approximation
            cover: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            description: item.snippet.description
        }));
    },

    // Get Trending Music Videos
    getTrendingVideos: async (apiKey) => {
        if (!apiKey) throw new Error("No API Key provided");

        // videoCategoryId=10 is "Music"
        const url = `${YOUTUBE_API_ENDPOINT}/videos?part=snippet&chart=mostPopular&regionCode=US&videoCategoryId=10&maxResults=10&key=${apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || "YouTube trending fetch failed");
        }

        const data = await response.json();

        return data.items.map(item => ({
            id: item.id,
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            cover: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            description: item.snippet.description
        }));
    },

    // Get cover art from YouTube Music
    getCoverArt: async (songTitle, artistName) => {
        const apiKey = localStorage.getItem("youtube_api_key");

        if (!apiKey) {
            return null;
        }

        try {
            const cleanTitle = songTitle.replace(/\s*\(.*?\)\s*/g, '').trim();
            const cleanArtist = artistName.replace(/\s(ft\.|feat\.|\&).*$/i, '').trim();

            const query = `${cleanTitle} ${cleanArtist} official audio`;
            const res = await fetch(
                `${YOUTUBE_API_ENDPOINT}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=3&key=${apiKey}`
            );

            if (!res.ok) return null;

            const data = await res.json();

            if (data.items && data.items.length > 0) {
                // Get the highest quality thumbnail available
                const thumbnail = data.items[0].snippet.thumbnails;
                return thumbnail.high?.url || thumbnail.medium?.url || thumbnail.default?.url;
            }

            return null;
        } catch (error) {
            console.warn('YouTube cover art fetch failed:', error);
            return null;
        }
    },

    // Find the most viewed YouTube Music video for a song
    getMostViewedVideo: async (songTitle, artistName) => {
        const apiKey = localStorage.getItem("youtube_api_key");

        if (!apiKey) {
            // Fallback to YouTube Music search URL if no API key
            return `https://music.youtube.com/search?q=${encodeURIComponent(songTitle + ' ' + artistName)}`;
        }

        try {
            const cleanTitle = songTitle.replace(/\s*\(.*?\)\s*/g, '').trim();
            const cleanArtist = artistName.replace(/\s(ft\.|feat\.|\&).*$/i, '').trim();

            // Try 1: Search for official audio (best match)
            let query = `${cleanTitle} ${cleanArtist} official audio`;
            let res = await fetch(
                `${YOUTUBE_API_ENDPOINT}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=5&key=${apiKey}`
            );
            let data = await res.json();

            // Try 2: If no results, try official video
            if (!data.items || data.items.length === 0) {
                query = `${cleanTitle} ${cleanArtist} official video`;
                res = await fetch(
                    `${YOUTUBE_API_ENDPOINT}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=5&key=${apiKey}`
                );
                data = await res.json();
            }

            // Try 3: If still no results, try without "official"
            if (!data.items || data.items.length === 0) {
                query = `${cleanTitle} ${cleanArtist}`;
                res = await fetch(
                    `${YOUTUBE_API_ENDPOINT}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=5&key=${apiKey}`
                );
                data = await res.json();
            }

            if (data.items && data.items.length > 0) {
                // Prefer videos with "official" in title
                const officialVideo = data.items.find(item =>
                    item.snippet.title.toLowerCase().includes('official')
                );
                const videoId = (officialVideo || data.items[0]).id.videoId;
                // Return YouTube Music link instead of regular YouTube
                return `https://music.youtube.com/watch?v=${videoId}`;
            }

            // Fallback to YouTube Music search if no results
            return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
        } catch (error) {
            console.error("YouTube API failed:", error);
            // Fallback to YouTube Music search URL
            return `https://music.youtube.com/search?q=${encodeURIComponent(songTitle + ' ' + artistName)}`;
        }
    }
};
