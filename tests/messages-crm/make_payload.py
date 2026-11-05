# Synthetic cross-language contract fixture, never used on a real database.
import json
from test_collector import CollectorTest, c, NOW
fixture = CollectorTest(); fixture.setUp()
try:
    c.collect(fixture.source, fixture.cache, fixture.config, now=NOW, force=True)
    print(json.dumps(c.snapshot(fixture.cache, fixture.config, now=NOW)))
finally:
    fixture.tearDown()
