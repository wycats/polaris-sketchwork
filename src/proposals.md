# Polaris Sketchwork

This is a collection of proposals and other sketches that I (@wycats) am working on fleshing out for inclusion in Polaris.

In general, they attempt to flesh out and clarify the existing vision for Polaris, which I outlined in my [EmberConf 2022 keynote](https://www.youtube.com/watch?v=3Bj4EEoztk4&t=1207s).

At the moment, much of the work of Polaris is underway, and most of the features slated for Polaris have already been implemented in some form. However, there is no cohesive description of the big-picture vision of various features.

In addition some of Polaris' well-established goals have implications that have not yet been described clearly. In particular, two major goals of Polaris are the unification of template and JavaScript features  and the elimination of dependencies on classic Ember features in idiomatic Polaris apps. Taken together, these goals require changes to the Ember router, which is the last remaining piece of critical Ember infrastructure that fundamentally depends upon classic features. It's also glaringly out of sync with the lifetime management story of the rest of modern Ember.

Despite this implication, we don't yet have a single place that fleshes out what that **means**.

My goal with this repository is to provide my personal understanding of the high-level design vision of Polaris, as well as my best guess at proposals that still require additional work.

I plan to add more proposals over the next few weeks and months, but wanted to get the stuff I already wrote down out there in the meantime.

Feel free to file issues on [GitHub](https://github.com/wycats/polaris-sketchwork) if you have questions or thoughts!