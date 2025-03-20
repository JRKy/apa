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
    if (location) debouncedUpdateMap(location.lat, loc.lon, loc.city);
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
                alt: sat.name // Added alt text for accessibility
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
                'aria-label': `Satellite label for ${sat.name}` // Added aria-label for accessibility
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
                    alt: 'Custom Location Marker' // Added alt text for accessibility
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
        navigator.serviceWorker.register('/sw.js')
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
