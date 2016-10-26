import { toAbsoluteUri, getOrCreateEntry } from '../../utils';
import { parseLinkHeader } from '../../utils.parseLinkHeader';

import EngineUnit from '../../Framework/EngineUnit';
import ChangesResourcePart from './ChangesResourcePart';
import ChangesWaitConnection from './ChangesWaitConnection';
import CollectionEntry from '../../Framework/CollectionEntry';

class ChangesEngineUnit extends EngineUnit {
    constructor() {
        super();

        this._changesWaitConnections = [];

        this._liveResourceItemIds = new WeakMap();
    }

    updateEndpointsToResourceParts(parts) {

        var changesWaitItems = new Map();
        parts.forEach(part => {
            if (part.linkUris['CHANGES_WAIT']) {
                changesWaitItems.set(part.linkUris['CHANGES_WAIT'], part);
            }
        });

        var changesWaitEndpoints = new Map();
        changesWaitItems.forEach((endpoint, endpointUri) => {
            changesWaitEndpoints.set(endpointUri, { endpointUri, item: endpoint });
        });

        this.updateConnectionsToMatchEndpoints(
            'Changes Wait',
            this._changesWaitConnections,
            changesWaitEndpoints,
            endpoint => new ChangesWaitConnection(this, endpoint)
        );
    }

    createResourcePart(resourceHandler) {
        var resource = new ChangesResourcePart(resourceHandler);

        var request = this.createLongPoll();
        request.on('finished', (code, result, headers) => {

            if (code >= 200 && code < 300) {
                this.updateResourcePart(resource, headers, result);
                if (!resource.linkUris['CHANGES_WAIT']) {
                    console.info('no changes-wait link');
                }
                this.updateEngine();
                request = null;
            } else if (code >= 400) {
                request.retry();
            }
        });
        request.start('HEAD', resourceHandler.uri);

        return resource;
    }

    get interestType() {
        return 'changes';
    }

    get events() {
        return ['child-added', 'child-removed'];
    }

    updateResourcePart(resourcePart, headers, result) {

        var parsedHeaders = ChangesEngineUnit.parseHeaders(headers, resourcePart.resourceHandler.uri);

        this.updateConnection(resourcePart, this._changesWaitConnections, 'CHANGES_WAIT', parsedHeaders.changesWaitUri);

        super.updateResourcePart(resourcePart, headers, result);
    }

    triggerEvents(part, headers, result) {

        // TODO: This timing of emitting 'ready' is incorrect.
        // It should be done separately, because it means the listening connection
        // is established.
        if (!part.started) {
            part.started = true;
            part.resourceHandler.triggerOnceOnlyEvent('ready', part.resourceHandler);
        }

        if (result) {
            // parsed are CollectionEntry items.
            part.resourceHandler.forEachLiveResource(liveResource => {
                var itemIds = getOrCreateEntry(this._liveResourceItemIds, liveResource, () => []);

                // TODO: ContentType
                const parsed = liveResource.parse(this.interestType, headers, result);
                parsed.forEach(parsedItem => {
                    if (parsedItem.deleted) {
                        liveResource.trigger('child-deleted', liveResource, parsedItem.item);
                        var deleteIndex = itemIds.indexOf(parsedItem.id);
                        if (deleteIndex >= 0) {
                            itemIds.splice(deleteIndex, 1);
                        }
                    } else {
                        if (itemIds.indexOf(parsedItem.id) >= 0) {
                            liveResource.trigger('child-updated', liveResource, parsedItem.item);
                        } else {
                            if (parsedItem.id) {
                                itemIds.push(parsedItem.id);
                            }
                            liveResource.trigger('child-added', liveResource, parsedItem.item);
                        }
                    }
                });
            });
        }
    }

    static parseHeaders(headers, baseUri) {
        var changesWaitUri = null;

        Object.keys(headers).forEach(key => {
            const header = headers[key];
            var k = key.toLowerCase();
            if (k == 'link') {
                var links = parseLinkHeader(header);
                if (links && links['changes-wait']) {
                    changesWaitUri = toAbsoluteUri(baseUri, links['changes-wait']['href']);
                }
            }
        });

        var result = {};

        if (changesWaitUri) {
            console.info('changes-wait: [' + changesWaitUri + ']');
            result.changesWaitUri = changesWaitUri;
        }

        return result;
    }

    defaultParser(headers, data) {
        const parsed = JSON.parse(data);
        const out = [];
        if (Array.isArray(parsed)) {
            const items = parsed;
            for (let i = 0; i < items.length; ++i) {
                const id = items[i].id;
                const deleted = items[i].deleted;
                delete items[i].deleted; // app should not see this
                out.push(new CollectionEntry(id, deleted, items[i]));
            }
        } else {
            const item = parsed;
            const id = item.id;
            const deleted = item.deleted;
            delete item.deleted; // app should not see this
            out.push(new CollectionEntry(id, deleted, item));
        }
        return out;
    }
}

export default ChangesEngineUnit;