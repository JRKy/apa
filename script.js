// Debounce utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to get approximate AOR bounds based on site data
function getAORBounds(aor) {
    if (!locations || !Array.isArray(locations)) {
        console.error('Locations data is not available or not an array');
        return null;
    }
    const aorLocations = locations.filter(loc => loc.aor === aor);
    if (aorLocations.length === 0) return null;

    const lats = aorLocations.map(loc => loc.lat);
    const lons = aorLocations.map(loc => loc.lon);
    return [
        [Math.min(...lats) - 5, Math.min(...lons) - 5], // Add buffer for better zoom
        [Math.max(...lats) + 5, Math.max(...lons) + 5]
    ];
}

function calculateAzEl(receiverLat, receiverLon, satCenterLon) {
    // Input validation
    if (typeof receiverLat !== 'number' || isNaN(receiverLat) || 
        typeof receiverLon !== 'number' || isNaN(receiverLon) || 
        typeof satCenterLon !== 'number' || isNaN(satCenterLon)) {
        console.error('Invalid input to calculateAzEl:', { receiverLat, receiverLon, satCenterLon });
        return { elevation: '-', azimuth: '-' };
    }

    try {
        const earthRadius = 6378.137;
        const geoRadius = 42164;

        const phi_r = receiverLat * Math.PI / 180;
        const lambda_r = receiverLon * Math.PI / 180;
        const lambda_s = satCenterLon * Math.PI / 180;

        const delta_lambda = lambda_s - lambda_r;
        const phi_s = 0;

        const phi_g = Math.atan(Math.pow(1 - 1/298.257223563, 2) * Math.tan(phi_r));

        const r = earthRadius / Math.sqrt(Math.cos(phi_g) * Math.cos(phi_g) + 
            Math.pow(1 - 1/298.257223563, 2) * Math.sin(phi_g) * Math.sin(phi_g));

        const x_r = r * Math.cos(phi_g) * Math.cos(lambda_r);
        const y_r = r * Math.cos(phi_g) * Math.sin(lambda_r);
        const z_r = r * Math.sin(phi_g);

        const x_s = geoRadius * Math.cos(lambda_s);
        const y_s = geoRadius * Math.sin(lambda_s);
        const z_s = 0;

        const rho_x = x_s - x_r;
        const rho_y = y_s - y_r;
        const rho_z = z_s - z_r;

        const sin_phi = Math.sin(phi_g);
        const cos_phi = Math.cos(phi_g);
        const sin_lambda = Math.sin(lambda_r);
        const cos_lambda = Math.cos(lambda_r);

        const rho_e = -sin_lambda * rho_x + cos_lambda * rho_y;
        const rho_n = -sin_phi * cos_lambda * rho_x - sin_phi * sin_lambda * rho_y + cos_phi * rho_z;
        const rho_z_top = cos_phi * cos_lambda * rho_x + cos_phi * sin_lambda * rho_y + sin_phi * rho_z;

        const range = Math.sqrt(rho_e * rho_e + rho_n * rho_n + rho_z_top * rho_z_top);
        const elevation = Math.asin(rho_z_top / range) * 180 / Math.PI;

        const azimuth = Math.atan2(rho_e, rho_n) * 180 / Math.PI;
        const normalizedAzimuth = (azimuth + 360) % 360;

        return { elevation: elevation, azimuth: normalizedAzimuth };
    } catch (error) {
        console.error('Error in calculateAzEl:', error);
        return { elevation: '-', azimuth: '-' };
    }
}

function populateLocationSelect() {
    const select = document.getElementById('locationSelect');
    if (!select) {
        console.error('locationSelect element not found');
        return;
    }
    while (select.options.length > 1) {
        select.remove(1);
    }
    if (!locations || !Array.isArray(locations)) {
        console.error('Locations data is not available or not an array');
        return;
    }
    const sortedLocations = [...locations].sort((a, b) => a.city.localeCompare(b.city));
    sortedLocations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.city;
        option.textContent = location.city;
        select.appendChild(option);
    });
    const worldViewOption = document.createElement('option');
    worldViewOption.value = 'world-view';
    worldViewOption.textContent = 'World View';
    select.appendChild(worldViewOption);
}

function populateAORFilter() {
    const select = document.getElementById('aorFilter');
    const mobileSelect = document.getElementById('aorFilterMobile');
    if (!select || !mobileSelect) {
        console.error('aorFilter or aorFilterMobile element not found');
        return;
    }
    while (select.options.length > 1) select.remove(1);
    while (mobileSelect.options.length > 1) mobileSelect.remove(1);
    if (!locations || !Array.isArray(locations)) {
        console.error('Locations data is not available or not an array');
        return;
    }
    const aors = [...new Set(locations.map(loc => loc.aor))].sort((a, b) => a.localeCompare(b));
    aors.forEach(aor => {
        const option = document.createElement('option');
        option.value = aor;
        option.textContent = aor;
        select.appendChild(option);
        mobileSelect.appendChild(option.cloneNode(true));
    });
}

function populateCountryFilter() {
    const select = document.getElementById('countryFilter');
    const mobileSelect = document.getElementById('countryFilterMobile');
    if (!select || !mobileSelect) {
        console.error('countryFilter or countryFilterMobile element not found');
        return;
    }
    while (select.options.length > 1) select.remove(1);
    while (mobileSelect.options.length > 1) mobileSelect.remove(1);
    if (!locations || !Array.isArray(locations)) {
        console.error('Locations data is not available or not an array');
        return;
    }
    const countries = [...new Set(locations.map(loc => loc.country))].sort((a, b) => a.localeCompare(b));
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        select.appendChild(option);
        mobileSelect.appendChild(option.cloneNode(true));
    });
}

function populateMapControls() {
    const satelliteSelect = document.getElementById('satelliteSelect');
    if (!satelliteSelect) {
        console.error('satelliteSelect element not found');
        return;
    }
    if (!satellites || !Array.isArray(satellites)) {
        console.error('Satellites data is not available or not an array');
        return;
    }
    satellites.forEach(sat => {
        const div = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `sat-${sat.name}-mobile`;
        checkbox.checked = true;
        checkbox.setAttribute('aria-label', `Toggle visibility of ${sat.name} on mobile`);
        const label = document.createElement('label');
        label.htmlFor = `sat-${sat.name}-mobile`;
        label.textContent = sat.name;
        div.appendChild(checkbox);
        div.appendChild(label);
        satelliteSelect.appendChild(div);
        checkbox.addEventListener('change', () => {
            const selectedLocation = document.getElementById('locationSelect')?.value;
            const loc = locations.find(l => l.city === selectedLocation) || 
                (currentMarker ? { lat: currentMarker.getLatLng().lat, lon: currentMarker.getLatLng().lng, city: currentMarker.getPopup().getContent() } : null);
            if (loc) debouncedUpdateMap(loc.lat, loc.lon, loc.city);
        });
    });
}

function createLocationsTable() {
    const table = document.createElement('table');
    table.setAttribute('role', 'grid');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Site', 'Country', 'Latitude', 'Longitude'].forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header;
        th.setAttribute('scope', 'col');
        if (index < 4) {
            th.classList.add('sortable');
            th.style.cursor = 'pointer';
            th.dataset.sortDir = 'asc';
            th.setAttribute('aria-sort', 'none');
            th.setAttribute('tabindex', '0');
            th.addEventListener('click', () => sortTable(table, index));
            th.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    sortTable(table, index);
                }
            });
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    let filteredLocations = [...locations];
    const aorFilter = document.getElementById('aorFilter')?.value || '';
    const countryFilter = document.getElementById('countryFilter')?.value || '';
    const locationSelect = document.getElementById('locationSelect')?.value || '';

    if (aorFilter) filteredLocations = filteredLocations.filter(loc => loc.aor === aorFilter);
    if (countryFilter) filteredLocations = filteredLocations.filter(loc => loc.country === countryFilter);
    if (locationSelect && locationSelect !== 'world-view') filteredLocations = filteredLocations.filter(loc => loc.city === locationSelect);

    filteredLocations.forEach(location => {
        const row = document.createElement('tr');
        [location.city, location.country, location.lat.toFixed(4), location.lon.toFixed(4)]
            .forEach(text => {
                const td = document.createElement('td');
                td.textContent = text;
                row.appendChild(td);
            });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    return table;
}

function sortTable(table, colIndex) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const th = table.querySelector(`th:nth-child(${colIndex + 1})`);
    const sortDir = th.dataset.sortDir === 'asc' ? 'desc' : 'asc';
    th.dataset.sortDir = sortDir;
    th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');

    rows.sort((a, b) => {
        const aValue = a.cells[colIndex].textContent.trim();
        const bValue = b.cells[colIndex].textContent.trim();
        
        if (colIndex === 2 || colIndex === 3) { // Latitude or Longitude
            const aNum = parseFloat(aValue);
            const bNum = parseFloat(bValue);
            return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        return sortDir === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
    });

    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    rows.forEach(row => tbody.appendChild(row));
}

// Global variables to track Antenna Pointing Angles sort state
let antennaSortCol = 2; // Default to Center Lon (°)
let antennaSortDir = 'asc'; // Default to ascending
let isInitialLoad = true; // Track first load
let zoomControlAdded = false; // Flag to prevent zoom control duplication

function createAntennaTable(location) {
    const table = document.createElement('table');
    table.setAttribute('role', 'grid');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Show', 'Satellite', 'Lon (°)', 'El (°)', 'Az (°)'].forEach((header, index) => {
        const th = document.createElement('th');
        th.setAttribute('scope', 'col');
        if (index === 0) {
            const selectAll = document.createElement('span');
            selectAll.id = 'select-all';
            selectAll.textContent = 'All';
            selectAll.setAttribute('role', 'button');
            selectAll.setAttribute('tabindex', '0');
            selectAll.addEventListener('click', toggleAllSatellites);
            selectAll.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleAllSatellites();
                }
            });
            th.appendChild(selectAll);
            th.classList.add('checkbox-cell');
        } else {
            th.textContent = header;
            if (index === 1 || index === 2) {
                th.classList.add('sortable');
                th.style.cursor = 'pointer';
                th.dataset.sortDir = (index === antennaSortCol) ? antennaSortDir : 'asc';
                th.setAttribute('aria-sort', 'none');
                th.setAttribute('tabindex', '0');
                th.addEventListener('click', () => {
                    sortAntennaTable(table, index);
                });
                th.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        sortAntennaTable(table, index);
                    }
                });
            }
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    if (!satellites || !Array.isArray(satellites)) {
        console.error('Satellites data is not available or not an array');
        return table;
    }
    satellites.forEach(sat => {
        const row = document.createElement('tr');
        let elevation, azimuth;
        if (location) {
            ({ elevation, azimuth } = calculateAzEl(location.lat, location.lon, sat.centerLon));
        } else {
            elevation = '-';
            azimuth = '-';
        }

        const checkCell = document.createElement('td');
        checkCell.classList.add('checkbox-cell');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `sat-${sat.name}`;
        checkbox.setAttribute('aria-label', `Toggle visibility of ${sat.name}`);
        if (!location || document.getElementById('aorFilter').value || document.getElementById('countryFilter').value) {
            checkbox.checked = false;
        } else {
            checkbox.checked = location && elevation >= 0;
        }
        checkCell.appendChild(checkbox);
        row.appendChild(checkCell);

        const nameCell = document.createElement('td');
        nameCell.textContent = sat.name;
        row.appendChild(nameCell);

        const centerLonCell = document.createElement('td');
        centerLonCell.textContent = sat.centerLon.toFixed(1);
        row.appendChild(centerLonCell);

        const elCell = document.createElement('td');
        elCell.textContent = elevation === '-' ? '-' : elevation.toFixed(1);
        if (elevation !== '-' && elevation < 0) elCell.classList.add('negative-elevation');
        row.appendChild(elCell);

        const azCell = document.createElement('td');
        azCell.textContent = azimuth === '-' ? '-' : azimuth.toFixed(1);
        row.appendChild(azCell);

        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    if (isInitialLoad) {
        antennaSortCol = 2;
        antennaSortDir = 'asc';
        sortAntennaTable(table, 2);
        isInitialLoad = false;
    }

    return table;
}

function sortAntennaTable(table, colIndex) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const th = table.querySelector(`th:nth-child(${colIndex + 1})`);
    const sortDir = th.dataset.sortDir === 'asc' ? 'desc' : 'asc';
    th.dataset.sortDir = sortDir;
    th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');

    rows.sort((a, b) => {
        const aValue = a.cells[colIndex].textContent.trim();
        const bValue = b.cells[colIndex].textContent.trim();

        if (colIndex === 2) {
            const aNum = aValue === '-' ? Infinity : parseFloat(aValue);
            const bNum = bValue === '-' ? Infinity : parseFloat(bValue);
            return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
        }

        return sortDir === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });

    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    rows.forEach(row => tbody.appendChild(row));
}

function toggleAllSatellites() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="sat-"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    const selectedLocation = document.getElementById('locationSelect')?.value;
    const location = locations.find(loc => loc.city === selectedLocation) || 
        (currentMarker ? { lat: currentMarker.getLatLng().lat, lon: currentMarker.getLatLng().lng, city: currentMarker.getPopup().getContent() } : null);
    if (location) debouncedUpdateMap(location.lat, location.lon, location.city);
}

function getSatData(lat, lon) {
    if (!satellites || !Array.isArray(satellites)) {
        console.error('Satellites data is not available or not an array');
        return '';
    }
    const visibleSats = satellites.filter(sat => {
        const checkbox = document.getElementById(`sat-${sat.name}`);
        return checkbox ? checkbox.checked : true;
    });
    return visibleSats.map(sat => {
        const { elevation, azimuth } = calculateAzEl(lat, lon, sat.centerLon);
        return `${sat.name}: EL ${elevation.toFixed(1)}° | AZ ${azimuth.toFixed(1)}°`;
    }).join('<br>');
}

let map = null;
let azimuthLines = [];
let currentMarker = null;
let aorMarkers = [];
let satelliteMarkers = [];
let markerClusterGroup = null;

const debouncedUpdateMap = debounce(updateMap, 250);
const debouncedUpdateLabels = debounce(updateLabels, 250);

function updateMap(lat = null, lon = null, clickedCity = null, selectedAOR = null, selectedCountry = null) {
    const locationSelect = document.getElementById('locationSelect')?.value || '';
    const aorFilter = selectedAOR || document.getElementById('aorFilter')?.value || '';
    const countryFilter = selectedCountry || document.getElementById('countryFilter')?.value || '';
    const mapAnnouncements = document.getElementById('map-announcements');
    let location;

    if (lat !== null && lon !== null) {
        location = { lat, lon, city: clickedCity || locationSelect || 'Custom Location' };
    } else if (locationSelect && locationSelect !== 'world-view') {
        const loc = locations.find(loc => loc.city === locationSelect);
        if (loc) {
            lat = loc.lat;
            lon = loc.lon;
            clickedCity = loc.city;
            location = loc;
        }
    }

    if (!map) {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.error('Map element not found');
            return;
        }
        map = L.map('map', {
            minZoom: 1,
            maxBounds: [[-90, -180], [90, 150]],
            maxBoundsViscosity: 1.0,
            zoomControl: false
        }).fitBounds([[-90, -180], [90, 150]]);
        if (!zoomControlAdded) {
            L.control.zoom({
                position: 'bottomleft'
            }).addTo(map);
            zoomControlAdded = true;
        }
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);
        console.log('Tile layer added:', tileLayer);
        map.invalidateSize();

        map.on('zoomend', debouncedUpdateLabels);
        map.on('moveend', debouncedUpdateLabels);

        if (!satellites || !Array.isArray(satellites)) {
            console.error('Satellites data is not available or not an array');
            return;
        }
        markerClusterGroup = L.markerClusterGroup();
        satellites.forEach(sat => {
            const satIcon = L.icon({
                iconUrl: 'https://img.icons8.com/ios-filled/50/000000/satellite.png',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
                alt: sat.name
            });
            const marker = L.marker([0, sat.centerLon], { 
                icon: satIcon,
                keyboard: true,
                title: sat.name
            });
            marker.bindPopup(sat.name);
            marker.on('click', () => {
                if (location) {
                    const { elevation, azimuth } = calculateAzEl(location.lat, location.lon, sat.centerLon);
                    marker.bindPopup(`${sat.name}<br>Azimuth: ${azimuth.toFixed(1)}°<br>Elevation: ${elevation.toFixed(1)}°`).openPopup();
                    if (mapAnnouncements) {
                        mapAnnouncements.textContent = `${sat.name} popup opened. Azimuth: ${azimuth.toFixed(1)} degrees, Elevation: ${elevation.toFixed(1)} degrees.`;
                    }
                }
            });
            marker.on('keypress', (e) => {
                if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') {
                    marker.fire('click');
                }
            });
            const label = L.divIcon({
                className: 'sat-label',
                html: `<div>${sat.name}</div>`,
                iconSize: [null, 20],
                iconAnchor: [(sat.name.length * 6) / 2, -10]
            });
            const labelMarker = L.marker([0, sat.centerLon], { 
                icon: label,
                keyboard: true,
                title: sat.name,
                'aria-label': `Satellite label for ${sat.name}`
            });
            labelMarker.on('click', () => {
                if (location) {
                    const { elevation, azimuth } = calculateAzEl(location.lat, location.lon, sat.centerLon);
                    labelMarker.bindPopup(`${sat.name}<br>Azimuth: ${azimuth.toFixed(1)}°<br>Elevation: ${elevation.toFixed(1)}°`).openPopup();
                    if (mapAnnouncements) {
                        mapAnnouncements.textContent = `${sat.name} label popup opened. Azimuth: ${azimuth.toFixed(1)} degrees, Elevation: ${elevation.toFixed(1)} degrees.`;
                    }
                }
            });
            labelMarker.on('keypress', (e) => {
                if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') {
                    labelMarker.fire('click');
                }
            });
            markerClusterGroup.addLayer(marker);
            markerClusterGroup.addLayer(labelMarker);
            satelliteMarkers.push({ marker, labelMarker });
        });
        map.addLayer(markerClusterGroup);
    }

    const currentZoom = map.getZoom();
    if (locationSelect && locationSelect !== 'world-view') {
        map.setView([lat, lon], currentZoom);
    } else if (aorFilter) {
        const aorBounds = getAORBounds(aorFilter);
        if (aorBounds) {
            map.fitBounds(aorBounds);
        }
    } else if (countryFilter) {
        const countryLocations = locations.filter(loc => loc.country === countryFilter);
        if (countryLocations.length > 0) {
            const lats = countryLocations.map(loc => loc.lat);
            const lons = countryLocations.map(loc => loc.lon);
            const bounds = [
                [Math.min(...lats), Math.min(...lons)],
                [Math.max(...lats), Math.max(...lons)]
            ];
            map.fitBounds(bounds);
        }
    }

    // Clear existing azimuth lines
    azimuthLines.forEach(item => {
        if (item.line) map.removeLayer(item.line);
        if (item.label) map.removeLayer(item.label);
    });
    azimuthLines = [];

    aorMarkers.forEach(marker => map.removeLayer(marker));
    aorMarkers = [];

    if (currentMarker) {
        currentMarker.on('dragend', () => {
            const newLatLng = currentMarker.getLatLng();
            debouncedUpdateMap(newLatLng.lat, newLatLng.lng, 'Custom Location');
        });
    }

    let filteredLocations = [...locations];
    if (aorFilter) filteredLocations = filteredLocations.filter(loc => loc.aor === aorFilter);
    if (countryFilter) filteredLocations = filteredLocations.filter(loc => loc.country === countryFilter);
    if (locationSelect && locationSelect !== 'world-view') filteredLocations = filteredLocations.filter(loc => loc.city === locationSelect);

    filteredLocations.forEach(loc => {
        const aorMarker = L.marker([loc.lat, loc.lon], { 
            draggable: false,
            keyboard: true,
            title: loc.city
        });
        aorMarker.bindPopup(() => {
            const content = `${loc.city}<br>${getSatData(loc.lat, loc.lon)}`;
            aorMarker.getPopup().setContent(content);
            return content;
        });
        aorMarker.on('click', () => {
            const popup = aorMarker.getPopup();
            if (popup) {
                popup.openOn(map);
                if (mapAnnouncements) {
                    mapAnnouncements.textContent = `${loc.city} marker popup opened.`;
                }
            }
        });
        aorMarker.on('keypress', (e) => {
            if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') {
                aorMarker.fire('click');
            }
        });
        aorMarkers.push(aorMarker);
        markerClusterGroup.addLayer(aorMarker);
    });

    if (lat !== null && lon !== null) {
        if (!currentMarker) {
            currentMarker = L.marker([lat, lon], { 
                draggable: true,
                keyboard: true,
                title: 'Custom Location',
                icon: L.icon({
                    iconUrl: 'https://img.icons8.com/ios-filled/50/000000/satellite.png',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                    alt: 'Custom Location Marker'
                })
            });
            currentMarker.bindPopup(`${clickedCity}<br>${getSatData(lat, lon)}`);
            currentMarker.on('dragend', () => {
                const newLatLng = currentMarker.getLatLng();
                debouncedUpdateMap(newLatLng.lat, newLatLng.lng, 'Custom Location');
            });
            currentMarker.on('click', () => {
                if (mapAnnouncements) {
                    mapAnnouncements.textContent = `Custom marker popup opened at latitude ${lat}, longitude ${lon}.`;
                }
            });
            currentMarker.on('keypress', (e) => {
                if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') {
                    currentMarker.fire('click');
                }
            });
            markerClusterGroup.addLayer(currentMarker);
        } else {
            currentMarker.setLatLng([lat, lon]);
            currentMarker.bindPopup(`${clickedCity}<br>${getSatData(lat, lon)}`);
        }
    }

    const antennaControl = document.getElementById('antenna-control');
    if (antennaControl && antennaControl.style.display !== 'none') {
        antennaControl.innerHTML = '';
        const antennaTable = createAntennaTable(location);
        antennaControl.appendChild(antennaTable);
        antennaControl.querySelectorAll('.checkbox-cell input[type="checkbox"]').forEach(checkbox => {
            if (!checkbox.getAttribute('data-event-attached')) {
                checkbox.setAttribute('data-event-attached', 'true');
                checkbox.addEventListener('change', () => {
                    const loc = currentMarker ? { lat: currentMarker.getLatLng().lat, lon: currentMarker.getLatLng().lng, city: currentMarker.getPopup().getContent() } : location;
                    if (loc) debouncedUpdateMap(loc.lat, loc.lon, loc.city);
                });
            }
        });
        document.getElementById('antenna-toggle').setAttribute('aria-expanded', 'true');
    } else {
        document.getElementById('antenna-toggle').setAttribute('aria-expanded', 'false');
    }

    const locationsControl = document.getElementById('locations-control');
    if (locationsControl && locationsControl.style.display !== 'none') {
        locationsControl.innerHTML = '';
        const locationsTable = createLocationsTable();
        locationsControl.appendChild(locationsTable);
        document.getElementById('locations-toggle').setAttribute('aria-expanded', 'true');
    } else {
        document.getElementById('locations-toggle').setAttribute('aria-expanded', 'false');
    }

    if (!satellites || !Array.isArray(satellites)) {
        console.error('Satellites data is not available or not an array');
        return;
    }

    const loc = location || (currentMarker ? { lat: currentMarker.getLatLng().lat, lon: currentMarker.getLatLng().lng, city: currentMarker.getPopup().getContent() } : null);
    if (loc) {
        satellites.forEach(sat => {
            const checkbox = document.getElementById(`sat-${sat.name}`);
            if (checkbox && checkbox.checked) {
                const { elevation, azimuth } = calculateAzEl(loc.lat, loc.lon, sat.centerLon);
                const lineLength = 50;
                const earthRadius = 6371;

                const lat2 = loc.lat + (lineLength / earthRadius) * (180 / Math.PI) * Math.cos(azimuth * Math.PI / 180);
                const lon2 = loc.lon + (lineLength / earthRadius) * (180 / Math.PI) * Math.sin(azimuth * Math.PI / 180) / Math.cos(loc.lat * Math.PI / 180);

                const line = L.polyline([
                    [loc.lat, loc.lon],
                    [lat2, lon2]
                ], {
                    color: '#0078FF',
                    weight: 2,
                    opacity: 0.7
                }).addTo(map);
                line.bindPopup(`${sat.name}<br>Azimuth: ${azimuth.toFixed(1)}°<br>Elevation: ${elevation.toFixed(1)}°`);
                line.on('click', () => {
                    if (mapAnnouncements) {
                        mapAnnouncements.textContent = `${sat.name} plot line popup opened. Azimuth: ${azimuth.toFixed(1)} degrees, Elevation: ${elevation.toFixed(1)} degrees.`;
                    }
                });

                const labelClass = elevation < 0 ? 'negative-elevation' : '';
                const label = L.divIcon({
                    className: `sat-label ${labelClass}`,
                    html: `<div>${sat.name}</div>`,
                    iconSize: [null, 20],
                    iconAnchor: [(sat.name.length * 6) / 2, -10]
                });
                const labelMarker = L.marker([lat2, lon2], { 
                    icon: label,
                    keyboard: true,
                    title: sat.name
                }).addTo(map);
                labelMarker.bindPopup(`${sat.name}<br>Azimuth: ${azimuth.toFixed(1)}°<br>Elevation: ${elevation.toFixed(1)}°`);
                labelMarker.on('click', () => {
                    if (mapAnnouncements) {
                        mapAnnouncements.textContent = `${sat.name} plot line label popup opened. Azimuth: ${azimuth.toFixed(1)} degrees, Elevation: ${elevation.toFixed(1)} degrees.`;
                    }
                });
                labelMarker.on('keypress', (e) => {
                    if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') {
                        labelMarker.fire('click');
                    }
                });
                azimuthLines.push({ 
                    line, 
                    label: labelMarker, 
                    startLat: loc.lat, 
                    startLon: loc.lon, 
                    endLat: lat2, 
                    endLon: lon2, 
                    satName: sat.name,
                    azimuth
                });
                if (mapAnnouncements) {
                    mapAnnouncements.textContent = `${sat.name} plot line added.`;
                }
            }
        });
    }

    map.invalidateSize();
    debouncedUpdateLabels();
}

function createLabel(name, position, azimuth, startPosition, elevationClass) {
    const labelIcon = L.divIcon({
        className: `sat-label ${elevationClass}`,
        html: `<div>${name}</div>`,
        iconSize: [null, 20],
        iconAnchor: [(name.length * 6) / 2, 10]
    });

    return L.marker(position, { 
        icon: labelIcon,
        pane: 'markerPane',
        keyboard: true,
        title: name
    });
}

function updateLabels() {
    if (!map) return;

    const bounds = map.getBounds();
    const zoomLevel = map.getZoom();
    const lineLength = 50;
    const earthRadius = 6371;
    const mapAnnouncements = document.getElementById('map-announcements');

    azimuthLines.forEach(item => {
        if (item.label) {
            map.removeLayer(item.label);

            const scaleFactor = Math.pow(2, 8 - zoomLevel);
            const adjustedLength = lineLength * scaleFactor;

            const newLat = item.startLat + (adjustedLength / earthRadius) * (180 / Math.PI) * Math.cos(item.azimuth * Math.PI / 180);
            const newLon = item.startLon + (adjustedLength / earthRadius) * (180 / Math.PI) * Math.sin(item.azimuth * Math.PI / 180) / Math.cos(item.startLat * Math.PI / 180);

            let labelLat = newLat;
            let labelLon = newLon;

            if (!bounds.contains([labelLat, labelLon])) {
                const intersection = findIntersectionWithBounds(
                    [item.startLat, item.startLon],
                    [newLat, newLon],
                    bounds
                );
                if (intersection) {
                    labelLat = intersection.lat;
                    labelLon = intersection.lng;
                } else {
                    const center = map.getCenter();
                    const pixelPoint = map.latLngToContainerPoint([item.startLat, item.startLon]);
                    const pixelEnd = map.latLngToContainerPoint([center.lat, center.lng]);
                    const dx = Math.cos(item.azimuth * Math.PI / 180) * 50;
                    const dy = -Math.sin(item.azimuth * Math.PI / 180) * 50;
                    const newPixel = L.point(pixelPoint.x + dx, pixelPoint.y + dy);
                    const newLatLng = map.containerPointToLatLng(newPixel);
                    labelLat = newLatLng.lat;
                    labelLon = newLatLng.lng;
                }
            }

            const { elevation } = calculateAzEl(item.startLat, item.startLon, satellites.find(sat => sat.name === item.satName).centerLon);
            const labelClass = elevation < 0 ? 'negative-elevation' : '';
            item.label = L.marker([labelLat, labelLon], { 
                icon: L.divIcon({
                    className: `sat-label ${labelClass}`,
                    html: `<div>${item.satName}</div>`,
                    iconSize: [null, 20],
                    iconAnchor: [(item.satName.length * 6) / 2, -10]
                }),
                pane: 'markerPane',
                keyboard: true,
                title: item.satName
            }).addTo(map);
            item.label.bindPopup(`${item.satName}<br>Azimuth: ${item.azimuth.toFixed(1)}°<br>Elevation: ${elevation.toFixed(1)}°`);
            item.label.on('click', () => {
                if (mapAnnouncements) {
                    mapAnnouncements.textContent = `${item.satName} plot line label popup opened. Azimuth: ${item.azimuth.toFixed(1)} degrees, Elevation: ${elevation.toFixed(1)} degrees.`;
                }
            });
            item.label.on('keypress', (e) => {
                if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') {
                    item.label.fire('click');
                }
            });
        }
    });
}

function findIntersectionWithBounds(start, end, bounds) {
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();

    const startLat = start[0];
    const startLon = start[1];
    const endLat = end[0];
    const endLon = end[1];

    const dLat = endLat - startLat;
    const dLon = endLon - startLon;

    const intersections = [];

    if (dLat !== 0) {
        const t = (north - startLat) / dLat;
        if (t >= 0 && t <= 1) {
            const lon = startLon + t * dLon;
            if (lon >= west && lon <= east) {
                intersections.push({ lat: north, lng: lon, t: t });
            }
        }
    }

    if (dLat !== 0) {
        const t = (south - startLat) / dLat;
        if (t >= 0 && t <= 1) {
            const lon = startLon + t * dLon;
            if (lon >= west && lon <= east) {
                intersections.push({ lat: south, lng: lon, t: t });
            }
        }
    }

    if (dLon !== 0) {
        const t = (east - startLon) / dLon;
        if (t >= 0 && t <= 1) {
            const lat = startLat + t * dLat;
            if (lat >= south && lat <= north) {
                intersections.push({ lat: lat, lng: east, t: t });
            }
        }
    }

    if (dLon !== 0) {
        const t = (west - startLon) / dLon;
        if (t >= 0 && t <= 1) {
            const lat = startLat + t * dLat;
            if (lat >= south && lat <= north) {
                intersections.push({ lat: lat, lng: west, t: t });
            }
        }
    }

    if (intersections.length > 0) {
        return intersections.reduce((closest, current) => 
            current.t < closest.t ? current : closest);
    }
    return null;
}

function updateMapBasedOnFilter(filterId, selectedValue) {
    let lat = null, lon = null, clickedCity = null, selectedAOR = null, selectedCountry = null;

    switch (filterId) {
        case 'locationSelect':
            if (selectedValue === 'world-view') {
                map.fitBounds([[-90, -180], [90, 150]]);
                const antennaControl = document.getElementById('antenna-control');
                if (antennaControl) {
                    antennaControl.innerHTML = '';
                    const antennaTable = createAntennaTable(null);
                    antennaControl.appendChild(antennaTable);
                }
                debouncedUpdateMap();
                return;
            }
            const location = locations.find(loc => loc.city === selectedValue);
            if (location) {
                lat = location.lat;
                lon = location.lon;
                clickedCity = location.city;
                map.setView([lat, lon], 8);
            }
            break;
        case 'aorFilter':
            if (selectedValue) {
                selectedAOR = selectedValue;
                const aorBounds = getAORBounds(selectedAOR);
                if (aorBounds) {
                    map.fitBounds(aorBounds);
                }
            } else {
                map.fitBounds([[-90, -180], [90, 150]]);
            }
            break;
        case 'countryFilter':
            if (selectedValue) {
                selectedCountry = selectedValue;
                const countryLocations = locations.filter(loc => loc.country === selectedCountry);
                if (countryLocations.length > 0) {
                    const lats = countryLocations.map(loc => loc.lat);
                    const lons = countryLocations.map(loc => loc.lon);
                    const bounds = [
                        [Math.min(...lats), Math.min(...lons)],
                        [Math.max(...lats), Math.max(...lons)]
                    ];
                    map.fitBounds(bounds);
                }
            } else {
                map.fitBounds([[-90, -180], [90, 150]]);
            }
            break;
    }
    debouncedUpdateMap(lat, lon, clickedCity, selectedAOR, selectedCountry);
}

// Now define the event listener
document.addEventListener('DOMContentLoaded', () => {
    if (typeof locations === 'undefined' || typeof satellites === 'undefined') {
        console.error('Data not loaded. Please check data.js file.');
        return;
    }

    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
        populateLocationSelect();
        populateAORFilter();
        populateCountryFilter();

        const antennaControl = document.getElementById('antenna-control');
        if (antennaControl) {
            antennaControl.innerHTML = '';
            const defaultLocation = null;
            const antennaTable = createAntennaTable(defaultLocation);
            antennaControl.appendChild(antennaTable);
            antennaControl.style.display = 'none';
        }
        const locationsControl = document.getElementById('locations-control');
        if (locationsControl) {
            locationsControl.innerHTML = '';
            const locationsTable = createLocationsTable();
            locationsControl.appendChild(locationsTable);
            locationsControl.style.display = 'none';
        }
        debouncedUpdateMap();
    }
    populateMapControls();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }

    const filterDropdowns = document.querySelectorAll('.filter-dropdown');
    filterDropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            if (selectedValue) {
                filterDropdowns.forEach(otherDropdown => {
                    if (otherDropdown !== e.target) {
                        otherDropdown.value = '';
                    }
                });
                filterDropdowns.forEach(dd => dd.classList.remove('active-filter'));
                e.target.classList.add('active-filter');
            } else {
                e.target.classList.remove('active-filter');
            }
            try {
                updateMapBasedOnFilter(e.target.id, selectedValue);
            } catch (error) {
                console.error('Error updating map based on filter:', error);
            }
        });
    });

    document.getElementById('aorFilterMobile')?.addEventListener('change', (e) => {
        const selectedAOR = e.target.value;
        if (selectedAOR) {
            const aorBounds = getAORBounds(selectedAOR);
            if (aorBounds) {
                map.fitBounds(aorBounds);
            }
            debouncedUpdateMap(null, null, null, selectedAOR);
        } else {
            map.fitBounds([[-90, -180], [90, 150]]);
            debouncedUpdateMap();
        }
    });

    document.getElementById('countryFilterMobile')?.addEventListener('change', (e) => {
        const selectedCountry = e.target.value;
        if (selectedCountry) {
            const countryLocations = locations.filter(loc => loc.country === selectedCountry);
            if (countryLocations.length > 0) {
                const lats = countryLocations.map(loc => loc.lat);
                const lons = countryLocations.map(loc => loc.lon);
                const bounds = [
                    [Math.min(...lats), Math.min(...lons)],
                    [Math.max(...lats), Math.max(...lons)]
                ];
                map.fitBounds(bounds);
            }
            debouncedUpdateMap(null, null, null, null, selectedCountry);
        } else {
            map.fitBounds([[-90, -180], [90, 150]]);
            debouncedUpdateMap();
        }
    });

    const hamburger = document.getElementById('hamburger');
    const controlsPanel = document.getElementById('controls-panel');
    if (hamburger && controlsPanel) {
        hamburger.addEventListener('click', () => {
            const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !isExpanded);
            controlsPanel.classList.toggle('active');
            controlsPanel.setAttribute('aria-hidden', isExpanded);
        });
    }

    const antennaToggle = document.getElementById('antenna-toggle');
    const antennaControl = document.getElementById('antenna-control');
    if (antennaToggle && antennaControl) {
        antennaToggle.addEventListener('click', () => {
            const isVisible = antennaControl.style.display !== 'none';
            antennaControl.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                const locationsControl = document.getElementById('locations-control');
                if (locationsControl) locationsControl.style.display = 'none';
            }
            const location = currentMarker ? { lat: currentMarker.getLatLng().lat, lon: currentMarker.getLatLng().lng, city: currentMarker.getPopup().getContent() } : null;
            if (location) debouncedUpdateMap(location.lat, location.lon, location.city);
            adjustMapWidth();
        });
    }

    const locationsToggle = document.getElementById('locations-toggle');
    const locationsControl = document.getElementById('locations-control');
    if (locationsToggle && locationsControl) {
        locationsToggle.addEventListener('click', () => {
            const isVisible = locationsControl.style.display !== 'none';
            locationsControl.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                const antennaControl = document.getElementById('antenna-control');
                if (antennaControl) antennaControl.style.display = 'none';
                locationsControl.innerHTML = '';
                const locationsTable = createLocationsTable();
                locationsControl.appendChild(locationsTable);
            }
            adjustMapWidth();
        });
    }

    function adjustMapWidth() {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;
        const antennaVisible = antennaControl?.style.display !== 'none';
        const locationsVisible = locationsControl?.style.display !== 'none';
        mapElement.style.width = antennaVisible || locationsVisible ? 'calc(100% - 250px)' : '100%';
        map.invalidateSize();
    }
});
