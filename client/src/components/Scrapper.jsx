import React, { useState } from 'react';
import axios from 'axios';
import styles from '../App.module.css';

const Scrapper = () => {
  const [username, setUsername] = useState('');
  const [limit, setLimit] = useState(5);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Base URL loaded from env, fallback to localhost
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

  const fetchReels = async () => {
    if (!username.trim()) {
      setError('Please enter an Instagram username.');
      setReels([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);
    setLoading(true);
    setError('');
    setReels([]);

    try {
      const res = await axios.get(`${API_BASE_URL}/scrape`, {
        params: { username, limit },
      });

      if (!res.data.reels || res.data.reels.length === 0) {
        setError('No public reels found or profile is private.');
        setReels([]);
      } else {
        setReels(res.data.reels);
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Failed to fetch reels. Please try again later.'
      );
      setReels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchReels();
  };

  const handleLimitChange = (e) => {
    let val = Number(e.target.value);
    if (val < 1) val = 1;
    else if (val > 30) val = 30;
    setLimit(val);
  };

  return (
    <main className={styles.app} aria-busy={loading}>
      <h1 className={styles.title}>Instagram Reels Scraper</h1>
      <form
        className={styles.form}
        onSubmit={handleSubmit}
        aria-label="Instagram Reels Search"
      >
        <label htmlFor="username">Instagram Username:</label>
        <input
          id="username"
          type="text"
          placeholder="Enter Instagram username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          aria-required="true"
        />
        <label htmlFor="limit">Number of reels (1-30):</label>
        <input
          id="limit"
          type="number"
          min="1"
          max="30"
          value={limit}
          onChange={handleLimitChange}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Fetching...' : 'Fetch Reels'}
        </button>
      </form>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {!loading && !error && reels.length === 0 && hasSearched && (
        <p>No reels available for this user.</p>
      )}

      <section className={styles.reelsContainer} aria-live="polite">
        {reels.map((reel) => (
          <article key={reel.id} className={styles.reelCard}>
            <a
              href={reel.reel_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View reel ${reel.id} on Instagram`}
            >
              <video
                className={styles.video}
                width="320"
                height="240"
                controls
                poster={reel.thumbnail_url}
                preload="metadata"
              >
                <source src={reel.video_url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </a>
            <p className={styles.caption}>{reel.caption || <i>No caption</i>}</p>
            <p className={styles.meta}>
              Posted: {new Date(reel.posted_at).toLocaleString()}
            </p>
            {reel.views && <p className={styles.meta}>Views: {reel.views}</p>}
            {typeof reel.likes === 'number' && (
              <p className={styles.meta}>Likes: {reel.likes}</p>
            )}
            {reel.comments_count > 0 && (
              <p className={styles.meta}>Comments: {reel.comments_count}</p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
};

export default Scrapper;
