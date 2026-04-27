from __future__ import division
from __future__ import absolute_import

import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'


class baseline(object):
    def get_baseline_value(self):
        pass
    def update(self, target):
        pass

class ReactiveBaseline(baseline):
    def __init__(self, l):
        self.l = l
        self.b = 0.0
    def get_baseline_value(self):
        return self.b
    def update(self, target):
        self.b = (1 - self.l) * self.b + self.l * target