export const layerLogic = {
    toggleLayer(layer) {
        if (layer.checked) {
            // OPTIMASI: Mekanisme Cache
            if (this.leafletLayers[layer.id]) {
                this.leafletLayers[layer.id].addTo(this.map);
                return Promise.resolve();
            }

            return fetch(`/api/layers/${layer.id}/features`)
                .then((res) => res.json())
                .then((data) => {
                    if (!data || !data.features || data.features.length === 0) {
                        console.warn(
                            `Layer ${layer.name}: tidak ada features.`,
                        );
                        return;
                    }

                    // --- FIX UTAMA ---
                    // Deteksi geometry type dari feature pertama yang punya geometry
                    const firstFeature = data.features.find(
                        (f) => f.geometry && f.geometry.type,
                    );
                    const geomType = firstFeature
                        ? firstFeature.geometry.type
                        : "";
                    const isLine =
                        geomType === "LineString" ||
                        geomType === "MultiLineString";
                    const isPolygon =
                        geomType === "Polygon" || geomType === "MultiPolygon";

                    // PAKSA SVG renderer untuk LineString/MultiLineString
                    // karena preferCanvas:true di map-config menyebabkan
                    // garis tidak ter-render sama sekali di Leaflet Canvas.
                    const rendererOptions = isLine ? { renderer: L.svg() } : {};

                    const lLayer = L.geoJSON(data, {
                        ...rendererOptions,

                        pointToLayer: (f, latlng) =>
                            L.circleMarker(latlng, {
                                radius: 7,
                                fillOpacity: 0.8,
                                weight: 1.5,
                            }),

                        // FIX: style per geometry type agar tidak ada
                        // property yang konflik (misal fillOpacity pada garis)
                        style: (feature) => {
                            const type = feature.geometry
                                ? feature.geometry.type
                                : "";
                            const opacityVal = layer.opacity / 100;

                            if (
                                type === "LineString" ||
                                type === "MultiLineString"
                            ) {
                                return {
                                    color: layer.color,
                                    weight: 3,
                                    opacity: opacityVal,
                                };
                            }

                            if (type === "Polygon" || type === "MultiPolygon") {
                                return {
                                    color: layer.color,
                                    fillColor: layer.color,
                                    weight: 2,
                                    opacity: opacityVal,
                                    fillOpacity: opacityVal * 0.4,
                                };
                            }

                            // Default / Point (tidak dipakai karena ada pointToLayer)
                            return {
                                color: layer.color,
                                fillColor: layer.color,
                                weight: 2,
                                opacity: opacityVal,
                                fillOpacity: opacityVal * 0.4,
                            };
                        },

                        onEachFeature: (f, l) => {
                            // OPTIMASI: Indexing untuk akses cepat dari tabel
                            const fid = `db-${layer.id}-${Math.random()
                                .toString(36)
                                .substr(2, 9)}`;
                            f.properties._fid = fid;
                            f.properties._parentLayerId = layer.id;
                            this.featureIndex[fid] = l;

                            l.on("click", (e) => {
                                L.DomEvent.stopPropagation(e);
                                this.highlightFeature(l);
                                this.showPopupForFeature(l, f.properties);
                            });
                        },
                    }).addTo(this.map);

                    this.leafletLayers[layer.id] = lLayer;
                })
                .catch((err) => {
                    console.error(`Gagal load layer ${layer.name}:`, err);
                });
        } else {
            if (this.leafletLayers[layer.id]) {
                this.map.removeLayer(this.leafletLayers[layer.id]);
            }
        }
    },

    zoomToLayer(id) {
        const lLayer = this.leafletLayers[id];

        if (lLayer) {
            try {
                const bounds = lLayer.getBounds();
                if (bounds && bounds.isValid()) {
                    this.map.fitBounds(bounds, { padding: [50, 50] });
                }
            } catch (e) {
                console.warn("zoomToLayer: gagal getBounds", e);
            }
        } else {
            alert(
                "Aktifkan layer terlebih dahulu untuk melihat jangkauan data!",
            );
        }
    },

    highlightFeature(leafletLayer) {
        // Reset style layer sebelumnya jika ada
        if (this.selectedFeatureLayer && this.selectedFeatureLayer.setStyle) {
            const prev = this.selectedFeatureLayer;
            const parentId = prev.feature?.properties?._parentLayerId;
            const parentConfig = this.layers.find((ly) => ly.id === parentId);
            const color = parentConfig ? parentConfig.color : "#3b82f6";
            const geomType = prev.feature?.geometry?.type || "";

            if (geomType === "LineString" || geomType === "MultiLineString") {
                prev.setStyle({ color, weight: 3, opacity: 1 });
            } else {
                prev.setStyle({
                    color,
                    fillColor: color,
                    weight: 2,
                    fillOpacity: 0.4,
                });
            }
        }

        if (leafletLayer.setStyle) {
            const geomType = leafletLayer.feature?.geometry?.type || "";

            if (geomType === "LineString" || geomType === "MultiLineString") {
                leafletLayer.setStyle({
                    color: "#ffff00",
                    weight: 6,
                    opacity: 1,
                });
            } else {
                leafletLayer.setStyle({
                    color: "#ffff00",
                    fillColor: "#ffff00",
                    weight: 5,
                    fillOpacity: 0.8,
                });
            }
            leafletLayer.bringToFront();
        }
        this.selectedFeatureLayer = leafletLayer;
    },

    updateStyle(id) {
        const layer = this.layers.find((l) => l.id === id);
        if (!this.leafletLayers[id] || !layer) return;

        this.leafletLayers[id].setStyle((feature) => {
            const type = feature?.geometry?.type || "";
            const opacityVal = layer.opacity / 100;

            if (type === "LineString" || type === "MultiLineString") {
                return {
                    color: layer.color,
                    weight: 3,
                    opacity: opacityVal,
                };
            }

            return {
                color: layer.color,
                fillColor: layer.color,
                weight: 2,
                opacity: opacityVal,
                fillOpacity: opacityVal * 0.4,
            };
        });
    },
};
