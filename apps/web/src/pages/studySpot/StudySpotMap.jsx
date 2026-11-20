import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { FiCrosshair, FiMapPin, FiSearch, FiWifi, FiX, FiZap } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { studyApi, errorMessage } from 'features/study/api';
import styles from './studySpot.module.css';

const typeNames = {
  library: 'Thư viện',
  'self-study': 'Khu tự học',
  'group-space': 'Học nhóm',
  cafe: 'Cà phê',
};

const SEARCH_RADIUS_KM = 10;
const DEFAULT_MAP_CENTER = [21.0122, 105.8048];
const DEFAULT_MAP_ZOOM = 12;
const ANCHOR_MAP_ZOOM = 14;
const LOCATION_MAP_ZOOM = 17;

const getLocationPosition = (location) => {
  const [longitude, latitude] = location.coordinates.coordinates;
  return [latitude, longitude];
};

const formatDistance = (distanceMeters) => `${(distanceMeters / 1000).toFixed(1)} km`;

function MapFocus({ anchor, selectedLocation }) {
  const map = useMap();

  // Dua dia diem dang chon vao trung tam de nguoi dung khong bi mat ngu canh.
  useEffect(() => {
    if (selectedLocation) {
      map.flyTo(getLocationPosition(selectedLocation), LOCATION_MAP_ZOOM, { duration: 0.85 });
    } else if (anchor) {
      map.flyTo([anchor.latitude, anchor.longitude], ANCHOR_MAP_ZOOM, { duration: 1 });
    }
  }, [anchor, selectedLocation, map]);
  return null;
}

function MapClickPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        label: 'Điểm đã chọn trên bản đồ',
      });
    },
  });
  return null;
}

export default function StudySpotMap() {
  const [locations, setLocations] = useState([]);
  const [anchor, setAnchor] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [suitableFor, setSuitableFor] = useState('group');
  const [filters, setFilters] = useState({ type: '', wifi: false, power: false });

  useEffect(() => {
    let active = true;
    studyApi
      .get('/locations', {
        params: {
          type: filters.type || undefined,
          wifi: filters.wifi || undefined,
          power: filters.power || undefined,
        },
      })
      .then(({ data }) => {
        if (active) setLocations(data.data.locations);
      })
      .catch((error) => toast.error(errorMessage(error)));
    return () => {
      active = false;
    };
  }, [filters]);

  useEffect(() => {
    if (!anchor) {
      setNearby([]);
      return undefined;
    }
    let active = true;
    setNearbyLoading(true);
    studyApi
      .get('/locations/nearby', {
        params: {
          lat: anchor.latitude,
          lng: anchor.longitude,
          suitableFor,
          type: filters.type || undefined,
          wifi: filters.wifi || undefined,
          power: filters.power || undefined,
          radiusKm: SEARCH_RADIUS_KM,
        },
      })
      .then(({ data }) => {
        if (active) setNearby(data.data.locations);
      })
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => {
        if (active) setNearbyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [anchor, suitableFor, filters]);

  const searchLocation = async (event) => {
    event.preventDefault();
    if (!searchText.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://photon.komoot.io/api/?${new URLSearchParams({
          q: searchText.trim(),
          limit: '1',
        })}`,
        { headers: { 'Accept-Language': 'vi' } }
      );
      if (!response.ok) throw new Error('Dịch vụ tìm kiếm vị trí đang bận');
      const { features } = await response.json();
      const [result] = features || [];
      if (!result) return toast.error('Không tìm thấy vị trí này tại Việt Nam');
      const [longitude, latitude] = result.geometry.coordinates;
      const properties = result.properties || {};
      const label = [properties.name, properties.street, properties.city, properties.country]
        .filter(Boolean)
        .join(', ');
      setAnchor({
        latitude: Number(latitude),
        longitude: Number(longitude),
        label: label || searchText.trim(),
      });
      setSelectedLocation(null);
    } catch (error) {
      toast.error(error.message || 'Không tìm được vị trí');
    } finally {
      setSearching(false);
    }
  };

  const nearbyIds = new Set(nearby.map((location) => location._id));
  const selectLocation = (location) => setSelectedLocation(location);
  const setLocationAsAnchor = (location) => {
    const [latitude, longitude] = getLocationPosition(location);
    setSelectedLocation(null);
    setAnchor({ latitude, longitude, label: location.name });
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span>STUDY FLUX · STUDY SPOT</span>
          <h1>
            Chọn một điểm làm mốc,
            <br />
            tìm nơi học gần nhất.
          </h1>
          <p>Nhập địa chỉ hoặc click bản đồ, sau đó lọc nơi học phù hợp quanh điểm đó.</p>
        </div>
        <Link to="/study-meetups">Meetup của tôi →</Link>
      </header>

      <section className={styles.filters}>
        <form className={styles.locationSearch} onSubmit={searchLocation}>
          <FiSearch />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Nhập địa chỉ hoặc khu vực làm mốc…"
          />
          <button type="submit" disabled={searching}>
            {searching ? 'Đang tìm' : 'Chọn điểm'}
          </button>
        </form>
        <select
          value={filters.type}
          onChange={(event) => setFilters({ ...filters, type: event.target.value })}
        >
          <option value="">Mọi loại địa điểm</option>
          {Object.entries(typeNames).map(([id, name]) => (
            <option value={id} key={id}>
              {name}
            </option>
          ))}
        </select>
        <button
          className={filters.wifi ? styles.filterActive : ''}
          onClick={() => setFilters({ ...filters, wifi: !filters.wifi })}
        >
          <FiWifi /> Wi-Fi
        </button>
        <button
          className={filters.power ? styles.filterActive : ''}
          onClick={() => setFilters({ ...filters, power: !filters.power })}
        >
          <FiZap /> Ổ cắm
        </button>
        <select value={suitableFor} onChange={(event) => setSuitableFor(event.target.value)}>
          <option value="group">Phù hợp học nhóm</option>
          <option value="individual">Phù hợp học cá nhân</option>
        </select>
        <span className={styles.dataCount}>{locations.length} điểm trên bản đồ</span>
      </section>

      {tileError && (
        <p role="status" className={styles.mapWarning}>
          Không tải được nền bản đồ. Bạn vẫn có thể chọn điểm và xem thông tin địa điểm.
        </p>
      )}
      <section className={styles.mapLayout}>
        <aside className={styles.locationList}>
          <div className={styles.anchorSummary}>
            <FiCrosshair />
            <div>
              <small>ĐIỂM LÀM MỐC</small>
              <b>{anchor?.label || 'Chưa chọn vị trí'}</b>
              <span>
                {anchor
                  ? `${anchor.latitude.toFixed(5)}, ${anchor.longitude.toFixed(5)}`
                  : 'Nhập địa chỉ hoặc click vào bản đồ bên cạnh'}
              </span>
            </div>
          </div>

          {!anchor ? (
            <div className={styles.pickHint}>
              <FiMapPin />
              <h2>Chọn một điểm bất kỳ</h2>
              <p>Điểm đỏ sẽ được cố định và dùng làm tâm để tính khoảng cách.</p>
            </div>
          ) : (
            <section className={styles.nearbyResults}>
              <div className={styles.resultCount}>
                <b>{nearby.length} nơi học gần nhất</b>
                <span>Trong bán kính {SEARCH_RADIUS_KM} km</span>
              </div>
              {nearbyLoading ? (
                <p className={styles.resultMessage}>Đang tính khoảng cách…</p>
              ) : nearby.length ? (
                nearby.map((location, index) => (
                  <article
                    key={location._id}
                    className={
                      selectedLocation?._id === location._id ? styles.locationSelected : ''
                    }
                    role="button"
                    tabIndex="0"
                    onClick={() => selectLocation(location)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') selectLocation(location);
                    }}
                  >
                    <div className={styles.distanceBadge}>{index + 1}</div>
                    <div>
                      <small>{typeNames[location.type]}</small>
                      <h2>{location.name}</h2>
                      <p>{location.address}</p>
                      <div className={styles.facilities}>
                        <strong>{formatDistance(location.distanceMeters)}</strong>
                        {location.wifi && <span>Wi-Fi</span>}
                        {location.powerOutlets && <span>Ổ cắm</span>}
                        <span>★ {location.averageRating.toFixed(1)}</span>
                      </div>
                      <Link to={`/study-spots/${location._id}`}>Xem và tạo Meetup</Link>
                    </div>
                  </article>
                ))
              ) : (
                <p className={styles.resultMessage}>
                  Chưa có nơi học phù hợp trong 10 km. Hãy nới bộ lọc hoặc chọn điểm khác.
                </p>
              )}
            </section>
          )}
        </aside>

        <div className={styles.mapWrap}>
          <MapContainer
            center={DEFAULT_MAP_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            scrollWheelZoom
            preferCanvas
            className={styles.map}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              eventHandlers={{ tileerror: () => setTileError(true) }}
            />
            <MapClickPicker
              onPick={(point) => {
                setSelectedLocation(null);
                setAnchor(point);
              }}
            />
            <MapFocus anchor={anchor} selectedLocation={selectedLocation} />
            {anchor && (
              <CircleMarker
                center={[anchor.latitude, anchor.longitude]}
                radius={13}
                bubblingMouseEvents={false}
                pathOptions={{ color: '#fff', weight: 4, fillColor: '#d7193f', fillOpacity: 1 }}
              >
                <Popup>
                  <b>Điểm làm mốc</b>
                  <br />
                  {anchor.label}
                </Popup>
              </CircleMarker>
            )}
            {locations.map((location) => (
              <CircleMarker
                key={location._id}
                center={getLocationPosition(location)}
                radius={
                  selectedLocation?._id === location._id ? 13 : nearbyIds.has(location._id) ? 10 : 7
                }
                bubblingMouseEvents={false}
                pathOptions={{
                  color: '#fff',
                  weight: 3,
                  fillColor:
                    selectedLocation?._id === location._id
                      ? '#d7193f'
                      : nearbyIds.has(location._id)
                        ? '#8b142b'
                        : '#6f7782',
                  fillOpacity: 1,
                }}
                eventHandlers={{
                  click: () =>
                    selectLocation(
                      nearby.find((nearbyLocation) => nearbyLocation._id === location._id) ||
                        location
                    ),
                }}
              >
                <Popup>
                  <b>{location.name}</b>
                  <br />
                  {location.address}
                  <br />
                  Thông tin chi tiết đang hiển thị trên bản đồ.
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          {selectedLocation && (
            <article className={styles.mapPlaceCard}>
              <button
                className={styles.mapPlaceClose}
                aria-label="Đóng thông tin địa điểm"
                onClick={() => setSelectedLocation(null)}
              >
                <FiX />
              </button>
              <small>{typeNames[selectedLocation.type]}</small>
              <h2>{selectedLocation.name}</h2>
              <p>
                <FiMapPin /> {selectedLocation.address}
              </p>
              {selectedLocation.description && <p>{selectedLocation.description}</p>}
              <div className={styles.mapPlaceFacilities}>
                {Number.isFinite(selectedLocation.distanceMeters) && (
                  <strong>{formatDistance(selectedLocation.distanceMeters)}</strong>
                )}
                <span>★ {selectedLocation.averageRating.toFixed(1)}</span>
                <span>Yên tĩnh {selectedLocation.quietLevel}/5</span>
                {selectedLocation.wifi && <span>Wi-Fi</span>}
                {selectedLocation.powerOutlets && <span>Ổ cắm</span>}
              </div>
              <div className={styles.mapPlaceActions}>
                <button onClick={() => setLocationAsAnchor(selectedLocation)}>
                  <FiCrosshair /> Dùng làm mốc
                </button>
                <Link to={`/study-spots/${selectedLocation._id}`}>Xem chi tiết →</Link>
              </div>
            </article>
          )}
          <div className={styles.mapInstruction}>
            <FiCrosshair /> Click marker để xem thông tin · click nền bản đồ để đặt tâm tìm kiếm
          </div>
        </div>
      </section>
    </main>
  );
}
