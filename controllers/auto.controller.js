import Autoplus from "../mongodb/models/autoplus.js";


const getAllAutopluses = async (req, res) => {

    const {
        _end,
        _order,
        _start,
        _sort,
        title_like = "",
    } = req.query;

    const query = {};


    if (title_like) {
        query.title = { $regex: title_like, $options: "i" };
    }

    try {
        const count = await Autoplus.countDocuments({ query });

        const properties = await Autoplus.find(query)
            .limit(_end)
            .skip(_start)
            .sort({ [_sort]: _order });

        res.header("x-total-count", count);
        res.header("Access-Control-Expose-Headers", "x-total-count");

        res.status(200).json(properties);

    } catch (error) {

        res.status(500).json({ message: error.message });

    }
};

const getAutoplusDetail = async (req, res) => {

    const { id } = req.params;
    const propertyExists = await Autoplus.findOne({ _id: id })

    if (propertyExists) {
        res.status(200).json(propertyExists);
    } else {
        res.status(404).json({ message: "Autoplus not found" });
    }

};

const createAutoplus = async (req, res) => {
    try {
        const {
            item_number,
            csku,
            fsku,
        } = req.body;


        if (!user) throw new Error("User not found");

        await Autoplus.create({
            item_number,
            csku,
            fsku
        });

        res.status(200).json({ message: "Autoplus created successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAutoplus = async (req, res) => {
    try {
        const { id } = req.params;
        const { item_number, csku, fsku} =
            req.body;


        await Autoplus.findByIdAndUpdate(
            { _id: id },
            {
                item_number,
                csku,
                fsku
            },
        );

        res.status(200).json({ message: "Autoplus updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteAutoplus = async (req, res) => {
    try {
        const { id } = req.params;

        const propertyToDelete = await Autoplus.findById({ _id: id })

        if (!propertyToDelete) throw new Error("Autoplus not found");

        propertyToDelete.remove();

        res.status(200).json({ message: "Autoplus deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export {
    getAllAutopluses,
    getAutoplusDetail,
    createAutoplus,
    updateAutoplus,
    deleteAutoplus,
};
