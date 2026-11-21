import { useEffect, useRef, useState } from 'react';
import { Search } from 'shared/icons/index';
import { Link } from 'react-router-dom';
import classes from './SearchMenu.module.css';
import { useSearch } from 'features/connections/hooks/useSearch';
import { useAddToSearch } from 'features/connections/hooks/useAddToSearch';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useRemoveFromSearch } from 'features/connections/hooks/useRemoveFromSearch';

function SearchMenu({ color, setShowSearchMenu, term, setTerm }) {
  const [showHistory, setShowHistory] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const input = useRef(null);

  const {
    mutate: search,
    data: searchData,
    isLoading: isSearchLoading,
    isSuccess: isSearchSuccess,
  } = useSearch();
  const { mutate: addToSearch, isSuccess: isAddedSuccess } = useAddToSearch();
  const { mutate: RemoveFromSearch, isSuccess: isRemovedSuccess } = useRemoveFromSearch();

  const {
    isLoading: isSearchHistoryLoading,
    data: searchHistort,
    isSuccess: isSearchHistorySuccess,
    refetch: refetchSearchHistory,
  } = useQuery({
    queryKey: ['searchHistory'],
    queryFn: async () => {
      const { data } = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/v1/users/search`, {
        withCredentials: true,
      });
      return data;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (window.matchMedia('(max-width: 1100px)').matches) input.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(term), 350);
    return () => clearTimeout(timer);
  }, [term]);

  // submit a new search
  useEffect(() => {
    if (searchTerm.trim().length > 0) {
      search({ term: searchTerm });
      setShowHistory(false);
    } else {
      setShowHistory(true);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (isAddedSuccess || isRemovedSuccess) {
      refetchSearchHistory();
    }
  }, [isAddedSuccess, isRemovedSuccess]);

  return (
    <section className={classes.search_area} aria-label="Kết quả tìm kiếm người dùng">
      <div className={classes.search_history_header}>
        <span>{showHistory ? 'Tìm kiếm gần đây' : 'Kết quả tìm kiếm'}</span>
        <button
          type="button"
          className={classes.close}
          aria-label="Đóng tìm kiếm"
          onClick={() => setShowSearchMenu(false)}
        >
          ×
        </button>
      </div>
      <div className={classes.mobile_search}>
        <Search color={color} />
        <input
          className={classes.input}
          type="text"
          placeholder="Tìm kiếm trên PTITSocial"
          aria-label="Tìm kiếm người dùng"
          ref={input}
          onChange={(e) => setTerm(e.target.value)}
          value={term}
        />
      </div>
      <div className={`scrollbar ${classes.results_scroll}`}>
        <div className={`${classes.search_results} `}>
          {!isSearchHistoryLoading &&
            isSearchHistorySuccess &&
            showHistory &&
            searchHistort?.data.results.length > 0 &&
            searchHistort?.data.results.map((user) => (
              <div
                className={`${classes.search_user_item} ${classes.search_item} hover2`}
                key={user._id}
              >
                <Link
                  to={`/profile/${user.user.username}`}
                  className={`${classes.search_item}`}
                  onClick={() => {
                    addToSearch({ user: user._id });
                    setTerm('');
                    setShowSearchMenu(false);
                  }}
                >
                  <div className={`${classes.search_result}`}>
                    <div>
                      <img className={classes.search_result_img} src={user.user.photo} alt="" />
                    </div>
                    <span>
                      {user.user.last_name} {user.user.first_name}
                    </span>
                  </div>
                </Link>
                <i
                  className="exit_icon"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    RemoveFromSearch({ user: user._id });
                  }}
                ></i>
              </div>
            ))}
        </div>
        <div className={`${classes.search_results} scrollbar`}>
          {!isSearchLoading &&
          isSearchSuccess &&
          !showHistory &&
          searchData?.data.results.length > 0 &&
          searchTerm.trim().length > 0 ? (
            searchData?.data.results.map((user) => (
              <Link
                to={`/profile/${user.username}`}
                className={`${classes.search_item} hover2`}
                onClick={() => {
                  addToSearch({ user: user._id });
                  setTerm('');
                  setShowSearchMenu(false);
                }}
                key={user._id}
              >
                <div className={`${classes.search_result}`}>
                  <div>
                    <img className={classes.search_result_img} src={user.photo} alt="" />
                  </div>
                  <span>
                    {user.last_name} {user.first_name}
                  </span>
                </div>
              </Link>
            ))
          ) : searchTerm ? (
            <p style={{ padding: '10px' }}>Không tìm thấy người dùng</p>
          ) : (
            ''
          )}
        </div>
      </div>
    </section>
  );
}

export default SearchMenu;
