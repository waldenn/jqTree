// tslint:disable: no-string-literal
import * as $ from "jquery";

export const Position = {
    getName: (position: number): string => {
        return Position.strings[position - 1];
    },

    nameToIndex: (name): number => {
        for (let i = 1; i <= Position.strings.length; i++) {
            if (Position.strings[i - 1] === name) {
                return i;
            }
        }

        return 0;
    },

    BEFORE: 1,
    AFTER: 2,
    INSIDE: 3,
    NONE: 4,

    strings: ["before", "after", "inside", "none"]
};

export class Node {
    public id: any;
    public name: string;
    public children: Node[];
    public parent: Node;
    public id_mapping: Object;
    public tree: Node;
    public node_class;  // todo: type class?
    public load_on_demand: boolean;
    public is_open: boolean;
    public element;
    public is_loading: boolean;

    constructor(o: Object, is_root: boolean = false, node_class = Node) {
        this.name = "";

        this.setData(o);

        this.children = [];
        this.parent = null;

        if (is_root) {
            this.id_mapping = {};
            this.tree = this;
            this.node_class = node_class;
        }
    }

    /*
    Set the data of this node.

    setData(string): set the name of the node
    setdata(object): set attributes of the node

    Examples:
        setdata('node1')

        setData({ name: 'node1', id: 1});

        setData({ name: 'node2', id: 2, color: 'green'});

    * This is an internal function; it is not in the docs
    * Does not remove existing node values
    */
    public setData(o: Object) {
        const setName = (name: string) => {
            if (name != null) {
                this.name = name;
            }
        };

        if (!o) {
            return;
        } else if (typeof o !== "object") {
            setName(o);
        } else {
            for (let key in o) {
                if (o.hasOwnProperty(key)) {
                    const value = o[key];

                    if (key === "label") {
                        // You can use the 'label' key instead of 'name'; this is a legacy feature
                        setName(value);
                    } else if (key !== "children") {
                        // You can't update the children using this function
                        this[key] = value;
                    }
                }
            }
        }
    }

    /*
    Create tree from data.

    Structure of data is:
    [
        {
            label: 'node1',
            children: [
                { label: 'child1' },
                { label: 'child2' }
            ]
        },
        {
            label: 'node2'
        }
    ]
    */
    public loadFromData(data: Object[]) {
        this.removeChildren();

        for (let o of data) {
            const node = new this.tree.node_class(o);
            this.addChild(node);

            // tslint:disable-next-line: no-string-literal
            if (typeof o === "object" && o["children"]) {
                // tslint:disable-next-line: no-string-literal
                node.loadFromData(o["children"]);
            }
        }
    }

    /*
    Add child.

    tree.addChild(
        new Node('child1')
    );
    */
    public addChild(node: Node) {
        this.children.push(node);
        node._setParent(this);
    }

    /*
    Add child at position. Index starts at 0.

    tree.addChildAtPosition(
        new Node('abc'),
        1
    );
    */
    public addChildAtPosition(node: Node, index: number) {
        this.children.splice(index, 0, node);
        node._setParent(this);
    }

    /*
    Remove child. This also removes the children of the node.

    tree.removeChild(tree.children[0]);
    */
    public removeChild(node: Node) {
        // remove children from the index
        node.removeChildren();

        this._removeChild(node);
    }

    /*
    Get child index.

    var index = getChildIndex(node);
    */
    public getChildIndex(node: Node) {
        return $.inArray(node, this.children);
    }

    /*
    Does the tree have children?

    if (tree.hasChildren()) {
        //
    }
    */
    public hasChildren(): boolean {
        return this.children.length !== 0;
    }

    public isFolder(): boolean {
        return this.hasChildren() || this.load_on_demand;
    }

    /*
    Iterate over all the nodes in the tree.

    Calls callback with (node, level).

    The callback must return true to continue the iteration on current node.

    tree.iterate(
        function(node, level) {
           console.log(node.name);

           // stop iteration after level 2
           return (level <= 2);
        }
    );

    */
    public iterate(callback: Function) {
        const _iterate = (node: Node, level: number) => {
            if (node.children) {
                for (let child of node.children) {
                    const result = callback(child, level);

                    if (result && child.hasChildren()) {
                        _iterate(child, level + 1);
                    }
                }
                return null;
            }
        };

        _iterate(this, 0);
    }

    /*
    Move node relative to another node.

    Argument position: Position.BEFORE, Position.AFTER or Position.Inside

    // move node1 after node2
    tree.moveNode(node1, node2, Position.AFTER);
    */
    public moveNode(moved_node: Node, target_node: Node, position: number) {
        if (moved_node.isParentOf(target_node)) {
            // Node is parent of target node. This is an illegal move
            return;
        }

        moved_node.parent._removeChild(moved_node);
        if (position === Position.AFTER) {
            target_node.parent.addChildAtPosition(
                moved_node,
                target_node.parent.getChildIndex(target_node) + 1
            );
        } else if (position === Position.BEFORE) {
            target_node.parent.addChildAtPosition(
                moved_node,
                target_node.parent.getChildIndex(target_node)
            );
        } else if (position === Position.INSIDE) {
            // move inside as first child
            target_node.addChildAtPosition(moved_node, 0);
        }
    }

    /*
    Get the tree as data.
    */
    public getData(include_parent = false): Object[] {
        function getDataFromNodes(nodes: Node[]): Object[] {
            return nodes.map(
                node => {
                    const tmp_node = {};

                    for (let k in node) {
                        if (
                            ["parent", "children", "element", "tree"].indexOf(k) === -1 &&
                            Object.prototype.hasOwnProperty.call(node, k)
                        ) {
                            const v = node[k];
                            tmp_node[k] = v;
                        }
                    }

                    if (node.hasChildren()) {
                        tmp_node["children"] = getDataFromNodes(node.children);
                    }

                    return tmp_node;
                }
            );
        }

        if (include_parent) {
            return getDataFromNodes([this]);
        } else {
            return getDataFromNodes(this.children);
        }
    }

    public getNodeByName(name: string): Node | null {
        return this.getNodeByCallback(
            node => node.name === name
        );
    }

    public getNodeByCallback(callback: Function): Node | null {
        let result = null;

        this.iterate(
            node => {
                if (callback(node)) {
                    result = node;
                    return false;
                } else {
                    return true;
                }
            }
        );

        return result;
    }

    public addAfter(node_info: Object): Node | null {
        if (! this.parent) {
            return null;
        } else {
            const node = new this.tree.node_class(node_info);

            const child_index = this.parent.getChildIndex(this);
            this.parent.addChildAtPosition(node, child_index + 1);

            if (typeof node_info === "object" && node_info["children"] && node_info["children"].length) {
                node.loadFromData(node_info["children"]);
            }

            return node;
        }
    }

    public addBefore(node_info: Object): Node | null {
        if (! this.parent) {
            return null;
        } else {
            const node = new this.tree.node_class(node_info);

            const child_index = this.parent.getChildIndex(this);
            this.parent.addChildAtPosition(node, child_index);

            if (typeof node_info === "object" && node_info["children"] && node_info["children"].length) {
                node.loadFromData(node_info["children"]);
            }

            return node;
        }
    }

    public addParent(node_info: Object): Node | null {
        if (! this.parent) {
            return null;
        } else {
            const new_parent = new this.tree.node_class(node_info);
            new_parent._setParent(this.tree);
            const original_parent = this.parent;

            for (let child of original_parent.children) {
                new_parent.addChild(child);
            }

            original_parent.children = [];
            original_parent.addChild(new_parent);
            return new_parent;
        }
    }

    public remove() {
        if (this.parent) {
            this.parent.removeChild(this);
            this.parent = null;
        }
    }

    public append(node_info: Object): Node {
        const node = new this.tree.node_class(node_info);
        this.addChild(node);

        if (typeof node_info === "object" && node_info["children"] && node_info["children"].length) {
            node.loadFromData(node_info["children"]);
        }

        return node;
    }

    public prepend(node_info: Object): Node {
        const node = new this.tree.node_class(node_info);
        this.addChildAtPosition(node, 0);

        if (typeof node_info === "object" && node_info["children"] && node_info["children"].length) {
            node.loadFromData(node_info["children"]);
        }

        return node;
    }

    public isParentOf(node: Node): boolean {
        let parent = node.parent;

        while (parent) {
            if (parent === this) {
                return true;
            }

            parent = parent.parent;
        }

        return false;
    }

    public getLevel(): number {
        let level = 0;
        let node: Node = this;

        while (node.parent) {
            level += 1;
            node = node.parent;
        }

        return level;
    }

    public getNodeById(node_id: any): Node | null {
        return this.id_mapping[node_id];
    }

    public addNodeToIndex(node: Node) {
        if (node.id != null) {
            this.id_mapping[node.id] = node;
        }
    }

    public removeNodeFromIndex(node: Node) {
        if (node.id != null) {
            delete this.id_mapping[node.id];
        }
    }

    public removeChildren() {
        this.iterate(
            child => {
                this.tree.removeNodeFromIndex(child);
                return true;
            }
        );

        this.children = [];
    }

    public getPreviousSibling(): Node | null {
        if (! this.parent) {
            return null;
        } else {
            const previous_index = this.parent.getChildIndex(this) - 1;
            if (previous_index >= 0) {
                return this.parent.children[previous_index];
            } else {
                return null;
            }
        }
    }

    public getNextSibling(): Node | null {
        if (! this.parent) {
            return null;
        } else {
            const next_index = this.parent.getChildIndex(this) + 1;
            if (next_index < this.parent.children.length) {
                return this.parent.children[next_index];
            } else {
                return null;
            }
        }
    }

    public getNodesByProperty(key: string, value: any): Node[] {
        return this.filter(
            node => node[key] === value
        );
    }

    public filter(f: Function) {
        const result = [];

        this.iterate(
            node => {
                if (f(node)) {
                    result.push(node);
                }

                return true;
            }
        );

        return result;
    }

    public getNextNode(include_children = true): Node | null {
        if (include_children && this.hasChildren() && this.is_open) {
            // First child
            return this.children[0];
        } else {
            if (! this.parent) {
                return null;
            } else {
                const next_sibling = this.getNextSibling();
                if (next_sibling) {
                    // Next sibling
                    return next_sibling;
                } else {
                    // Next node of parent
                    return this.parent.getNextNode(false);
                }
            }
        }
    }

    public getPreviousNode(): Node | null {
        if (! this.parent) {
            return null;
        } else {
            const previous_sibling = this.getPreviousSibling();
            if (previous_sibling) {
                if (! previous_sibling.hasChildren() || ! previous_sibling.is_open) {
                    // Previous sibling
                    return previous_sibling;
                } else {
                    // Last child of previous sibling
                    return previous_sibling.getLastChild();
                }
            } else {
                return this.getParent();
            }
        }
    }

    public getParent(): Node | null {
        // Return parent except if it is the root node
        if (! this.parent) {
            return null;
        } else if (! this.parent.parent) {
            // Root node -> null
            return null;
        } else {
            return this.parent;
        }
    }

    public getLastChild(): Node | null {
        if (! this.hasChildren()) {
            return null;
        } else {
            const last_child = this.children[this.children.length - 1];
            if (! last_child.hasChildren() || ! last_child.is_open) {
                return last_child;
            } else {
                return last_child.getLastChild();
            }
        }
    }

    // Init Node from data without making it the root of the tree
    private initFromData(data: Object[]) {
        const addNode = (node_data: any) => {
            this.setData(node_data);

            if (node_data["children"]) {
                addChildren(node_data["children"]);
            }
        };

        const addChildren = (children_data: Object[]) => {
            for (let child of children_data) {
                const node = new this.tree.node_class("");
                node.initFromData(child);
                this.addChild(node);
            }
        };

        addNode(data);
    }

    private _setParent(parent: Node) {
        this.parent = parent;
        this.tree = parent.tree;
        this.tree.addNodeToIndex(this);
    }

    private _removeChild(node: Node) {
        this.children.splice(
            this.getChildIndex(node),
            1
        );
        this.tree.removeNodeFromIndex(node);
    }
}