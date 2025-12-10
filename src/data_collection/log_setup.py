import os
import sys
import logging
from datetime import datetime


class CustomFormatter(logging.Formatter):
    def format(self, record):
        if record.getMessage().strip() == "":
            return ""
        return super().format(record)


def setup_logger():
    log_dir = os.path.join(os.getcwd(),'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Count log files and create new numbered log file with timestamp
    log_counter = len([file for file in os.listdir(log_dir) if file.endswith('.txt')]) + 1
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    log_filename = os.path.join(log_dir, f'log_{log_counter}_{timestamp}.txt')
    
    # Root-Logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # include filename and line number in every log entry
    formatter = CustomFormatter(
        '%(asctime)s %(name)s %(levelname)s [%(filename)s:%(lineno)d]: %(message)s'
    )
    
    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File Handler
    file_handler = logging.FileHandler(log_filename, mode='w', encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger