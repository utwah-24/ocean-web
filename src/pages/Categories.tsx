import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Category } from '../services/api';
import { Loader } from '../components/Loader';
import './Categories.css';

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await apiService.getCategories();
        setCategories(res.data || []);
      } catch (e) {
        console.error('Failed to load categories:', e);
        setError(
          e instanceof Error
            ? e.message
            : 'Failed to load categories from the API.'
        );
        setCategories([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="categories-page">
      <div className="categories-container">
        <h1 className="categories-title">Categories</h1>
        {loading ? (
          <Loader />
        ) : error ? (
          <div className="categories-empty">
            Failed to load categories from the API.
            <br />
            <small>{error}</small>
          </div>
        ) : categories.length === 0 ? (
          <div className="categories-empty">No categories available.</div>
        ) : (
          <div className="categories-grid">
            {categories.map((c) => (
              <div key={c.id} className="category-tile">
                {c.image ? <img src={c.image} alt={c.name} className="category-tile-image" /> : null}
                <div className="category-tile-name">{c.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


