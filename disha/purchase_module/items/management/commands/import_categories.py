# purchase_module/vendor/management/commands/import_categories.py
from django.core.management.base import BaseCommand
from items.models import MainCategory

class Command(BaseCommand):
    help = 'Import main categories into the database'

    def handle(self, *args, **kwargs):
        categories = [
            {"name": "PROGRAMMABLE LOGIC CONTROLLER", "code": "PLC"},
            {"name": "PRESSURE TRANSMITTER", "code": "PRT"},
            {"name": "HUMAN MACHINE INTERFACE", "code": "HMI"},
            {"name": "UNINTERRUPTED POWER SUPPLY", "code": "UPS"},
            {"name": "CABLE", "code": "CAB"},
            {"name": "PRESSURE GAUGE", "code": "PRG"},
            {"name": "Flow meter", "code": "EFM"},
            {"name": "LEVEL SENSOR", "code": "LVL"},
            {"name": "ELECTRICAL ACCESSORIES", "code": "ELA"},
            {"name": "COMMUNICATION MODEM", "code": "MOD"},
            {"name": "PANEL PARTS", "code": "PPA"},
            {"name": "IT ACCESSORIES", "code": "ITA"},
            {"name": "SERVICE", "code": "SER"},
            {"name": "VALVE AND ACTUATOR", "code": "MOV"},
            {"name": "O&G ACCESSORIES", "code": "ONG"},
            {"name": "PANEL", "code": "PNL"},
            {"name": "PLUMBING ACCESSORIES", "code": "PLA"},
            {"name": "CIMCON Products", "code": "CIM"},
            {"name": "IT SOFTWARES", "code": "ITS"},
            {"name": "Tools", "code": "TOO"},
            {"name": "CIVIL", "code": "CIV"},
            {"name": "Stationary", "code": "STA"},
            {"name": "Automatic Meter Reader", "code": "AMR"},
            {"name": "PACKING MATERIAL", "code": "PAC"},
            {"name": "MISCELLENOUS", "code": "MIS"},
            {"name": "WATER QUALITY ANALYSER", "code": "WQA"},
        ]

        for category in categories:
            MainCategory.objects.create(**category)
            self.stdout.write(self.style.SUCCESS(f'Successfully added {category["name"]}'))