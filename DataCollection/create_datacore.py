from db_handle import DataCoreHandle
from log_setup import setup_logger
import os


key_mapping = {
    -1 : "not detected",
    0 : "C",
    1 : "C#/Db",
    2 : "D",
    3 : "D#/Eb",
    4: "E",
    5: "F",
    6: "F#/Gb",
    7: "G",
    8: "G#/Ab",
    9: "A",
    10: "A#/Bb",
    11: "B"
}

mode_mapping = {
    0 : "minor",
    1: "Major"
}


logger = setup_logger()
cwd = os.getcwd()
pth = os.path.join(cwd, "DataStorage", "DataCore.db")
with open(pth, "w"):
    pass

handle = DataCoreHandle(db_path=pth, logger=logger, key_mapping=key_mapping,
                            mode_mapping=mode_mapping)

handle._create_tables()