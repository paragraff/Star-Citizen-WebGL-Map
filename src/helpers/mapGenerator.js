class MapGenerator {
  generate () {
    var stars = [];
    for (let i = 0; i < 2000; i++) {
      let coordinates = [
        Math.random() * 100 - 50,
        Math.random() * 100 - 50,
        Math.random() * 100 - 50
      ];
      stars.push({
        coordinates: coordinates,
        "crimeLevel": -1,
        "description": "Primarily a military system focused on supporting, housing, and training Xi’An ground troops. Its close proximity to the Perry Line made it strategically important during the Human / Xi’An cold war. Once relations normalized, Xi’An forces from the Perry Line systems withdrew to here.  ",
        "exporting": [],
        "faction": "XIAN",
        "hasWarning": false,
        "id": 54,
        "importing": [],
        "info": [],
        "isMajorTradeHub": false,
        "isOffLimits": false,
        "jumpPoints": [],
        color: 'Unknown',
        "name": Math.random().toString(36),
        "nickname": "",
        "size": "Medium",
        "status": "Known",
        "type": "SINGLE_STAR",
        "ueeStrategicValue": 9
      })
    }
    return stars;
  }
}

export default MapGenerator;
